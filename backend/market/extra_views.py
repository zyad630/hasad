"""
ViewSets for Modules 3–7:
  Module 3 — ItemUnit
  Module 4 — SalesOrder, PurchaseOrder (with convert-to-invoice action)
  Module 5 — SaleReturn, PurchaseReturn (with stock reversal)
  Module 6 — Employee, PayrollRun (run-payroll action)
  Module 7 — AdvancedCheck (deposit/clear/bounce lifecycle actions)
"""
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from inventory.models import ItemUnit, ShipmentItem
from sales.models import (
    Sale, SaleItem,
    SalesOrder, SalesOrderItem, PurchaseOrder, PurchaseOrderItem,
    SaleReturn, PurchaseReturn,
)
from finance.models import AdvancedCheck, CheckLifecycle
from hr.models import Employee, PayrollRun, PayrollLine
from finance.services import LedgerService

from market.extra_serializers import (
    ItemUnitSerializer,
    SalesOrderSerializer, PurchaseOrderSerializer,
    SaleReturnSerializer, PurchaseReturnSerializer,
    AdvancedCheckSerializer,
)
from hr.serializers import EmployeeSerializer, PayrollRunSerializer


# ── Module 3: ItemUnit ─────────────────────────────────────────────────────────

class ItemUnitViewSet(viewsets.ModelViewSet):
    """Manage units and prices per item."""
    serializer_class = ItemUnitSerializer
    filter_backends  = [DjangoFilterBackend]
    filterset_fields = ['item', 'is_default']

    def get_queryset(self):
        return ItemUnit.objects.filter(
            tenant=self.request.tenant
        ).select_related('item').order_by('item__name', 'unit_name')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)


# ── Module 4: SalesOrder ──────────────────────────────────────────────────────

class SalesOrderViewSet(viewsets.ModelViewSet):
    serializer_class = SalesOrderSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'customer']
    search_fields    = ['customer__name']

    def get_queryset(self):
        return SalesOrder.objects.filter(
            tenant=self.request.tenant
        ).select_related('customer', 'converted_sale').prefetch_related('items__item').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='convert-to-invoice')
    @transaction.atomic
    def convert_to_invoice(self, request, pk=None):
        """One-click: SalesOrder → Sale (invoice). Sets status to DELIVERED."""
        order = self.get_object()
        if order.status in ('delivered', 'cancelled'):
            return Response({'error': 'هذا الطلب محول أو ملغي بالفعل'}, status=400)
        if order.converted_sale:
            return Response({'error': 'تم تحويل الطلب مسبقاً'}, status=400)

        payment_type = request.data.get('payment_type', 'credit')
        sale = Sale.objects.create(
            tenant=order.tenant,
            customer=order.customer,
            created_by=request.user,
            payment_type=payment_type,
            total_amount=0,
        )
        total = Decimal('0')
        for oi in order.items.all():
            # Try to find an open ShipmentItem for this item
            si = ShipmentItem.objects.filter(
                shipment__tenant=order.tenant,
                item=oi.item,
                shipment__status='open',
                remaining_qty__gte=oi.quantity,
            ).select_for_update().first()
            if not si:
                return Response({'error': f'لا توجد كمية كافية من {oi.item.name}'}, status=400)

            subtotal = oi.quantity * oi.unit_price
            SaleItem.objects.create(
                sale=sale,
                shipment_item=si,
                quantity=oi.quantity,
                unit_price=oi.unit_price,
                subtotal=subtotal,
            )
            si.remaining_qty -= oi.quantity
            si.save(update_fields=['remaining_qty'])
            total += subtotal

        sale.total_amount = total
        sale.save(update_fields=['total_amount'])

        order.status = 'delivered'
        order.converted_sale = sale
        order.save(update_fields=['status', 'converted_sale'])

        # Post ledger entries
        LedgerService.record_sale(sale)

        return Response({'sale_id': str(sale.id), 'total': float(total)}, status=201)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    serializer_class = PurchaseOrderSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'supplier']
    search_fields    = ['supplier__name']

    def get_queryset(self):
        return PurchaseOrder.objects.filter(
            tenant=self.request.tenant
        ).select_related('supplier').prefetch_related('items__item').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='convert-to-shipment')
    @transaction.atomic
    def convert_to_shipment(self, request, pk=None):
        """One-click: PurchaseOrder → Shipment."""
        from inventory.models import Shipment
        order = self.get_object()
        if order.status in ('delivered', 'cancelled'):
            return Response({'error': 'هذا الأمر محول أو ملغي بالفعل'}, status=400)

        shipment_date = request.data.get('shipment_date') or str(timezone.now().date())
        shipment = Shipment.objects.create(
            tenant=order.tenant,
            supplier=order.supplier,
            shipment_date=shipment_date,
            deal_type=order.supplier.deal_type if order.supplier else 'commission',
        )
        for oi in order.items.all():
            ShipmentItem.objects.create(
                shipment=shipment,
                item=oi.item,
                quantity=oi.quantity,
                unit=oi.unit_name,
                remaining_qty=oi.quantity,
                expected_price=oi.unit_price,
            )

        order.status = 'delivered'
        order.converted_shipment = shipment
        order.save(update_fields=['status', 'converted_shipment'])

        return Response({'shipment_id': str(shipment.id)}, status=201)


# ── Module 5: Returns ──────────────────────────────────────────────────────────

class SaleReturnViewSet(viewsets.ModelViewSet):
    serializer_class = SaleReturnSerializer
    http_method_names = ['get', 'post', 'head', 'options']  # No PUT/PATCH/DELETE

    def get_queryset(self):
        return SaleReturn.objects.filter(
            tenant=self.request.tenant
        ).select_related('original_sale', 'created_by').prefetch_related('items').order_by('-return_date')

    @transaction.atomic
    def perform_create(self, serializer):
        ret = serializer.save(tenant=self.request.tenant, created_by=self.request.user)
        # Restore stock — select_for_update to prevent race conditions
        for item in ret.items.all():
            si = ShipmentItem.objects.select_for_update().get(pk=item.shipment_item_id)
            si.remaining_qty += item.quantity
            si.save(update_fields=['remaining_qty'])
        # Book reversing ledger entries
        LedgerService.record_sale_return(ret, user=self.request.user)


class PurchaseReturnViewSet(viewsets.ModelViewSet):
    serializer_class = PurchaseReturnSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        return PurchaseReturn.objects.filter(
            tenant=self.request.tenant
        ).select_related('original_shipment').prefetch_related('items').order_by('-return_date')

    @transaction.atomic
    def perform_create(self, serializer):
        ret = serializer.save(tenant=self.request.tenant, created_by=self.request.user)
        # Reduce stock (goods returned to supplier)
        for item in ret.items.all():
            si = ShipmentItem.objects.select_for_update().get(pk=item.shipment_item_id)
            si.remaining_qty = max(Decimal('0'), si.remaining_qty - item.quantity)
            si.save(update_fields=['remaining_qty'])


# ── Module 6: Employee & Payroll ───────────────────────────────────────────────

class EmployeeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeeSerializer
    filter_backends  = [filters.SearchFilter, DjangoFilterBackend]
    search_fields    = ['name', 'national_id', 'phone']
    filterset_fields = ['status']

    def get_queryset(self):
        return Employee.objects.filter(tenant=self.request.tenant).order_by('name')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)


class PayrollRunViewSet(viewsets.ModelViewSet):
    serializer_class = PayrollRunSerializer
    filter_backends  = [DjangoFilterBackend]
    filterset_fields = ['period', 'is_posted']

    def get_queryset(self):
        return PayrollRun.objects.filter(
            tenant=self.request.tenant
        ).prefetch_related('lines__employee').order_by('-run_date')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    @action(detail=False, methods=['post'], url_path='run')
    @transaction.atomic
    def run_payroll(self, request):
        """
        One-click payroll: calculates net salary for all active employees
        and books double-entry LedgerEntries (salary_expense → cash).
        """
        from django.utils.dateparse import parse_date

        period     = request.data.get('period')        # e.g. '2026-04'
        run_date   = request.data.get('run_date')      # e.g. '2026-04-30'
        overrides  = request.data.get('overrides', {}) # {emp_id: {days_worked, deductions, bonuses}}

        if not period or not run_date:
            return Response({'error': 'period و run_date مطلوبان'}, status=400)

        if PayrollRun.objects.filter(tenant=request.tenant, period=period).exists():
            return Response({'error': f'تم تشغيل رواتب {period} مسبقاً'}, status=400)

        employees = Employee.objects.filter(tenant=request.tenant, status='active')
        if not employees.exists():
            return Response({'error': 'لا يوجد موظفون نشطون'}, status=400)

        run = PayrollRun.objects.create(
            tenant=request.tenant,
            period=period,
            run_date=run_date,
            created_by=request.user,
        )

        lines_created = []
        for emp in employees:
            ov = overrides.get(str(emp.id), {})
            days_worked = int(ov.get('days_worked', emp.working_days_per_month))
            deductions  = Decimal(str(ov.get('deductions', '0')))
            bonuses     = Decimal(str(ov.get('bonuses', '0')))

            # Net = (basic_salary / working_days) * days_worked + bonuses - deductions
            daily_rate = emp.daily_rate()
            net = (daily_rate * days_worked + bonuses - deductions).quantize(Decimal('0.01'))
            net = max(Decimal('0'), net)

            line = PayrollLine.objects.create(
                payroll_run=run,
                employee=emp,
                days_worked=days_worked,
                basic_salary=emp.basic_salary,
                deductions=deductions,
                bonuses=bonuses,
                net_salary=net,
            )
            # Post ledger: DR salary_expense → CR cash
            LedgerService.record_salary_payment(line, user=request.user)
            line.ledger_posted = True
            line.save(update_fields=['ledger_posted'])
            lines_created.append({'employee': emp.name, 'net_salary': float(net)})

        run.is_posted = True
        run.save(update_fields=['is_posted'])

        return Response({
            'payroll_run_id': str(run.id),
            'period': period,
            'employees_count': len(lines_created),
            'total_payroll': float(sum(l['net_salary'] for l in lines_created)),
            'lines': lines_created,
        }, status=201)


# ── Module 7: AdvancedCheck ────────────────────────────────────────────────────

class AdvancedCheckViewSet(viewsets.ModelViewSet):
    serializer_class = AdvancedCheckSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['lifecycle', 'direction', 'customer', 'supplier']
    search_fields    = ['check_number', 'bank_name', 'drawer_name']

    def get_queryset(self):
        return AdvancedCheck.objects.filter(
            tenant=self.request.tenant
        ).select_related('customer', 'supplier').order_by('-due_date')

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant, created_by=self.request.user)

    def _transition(self, request, pk, new_lifecycle, timestamp_field=None, extra_fields=None):
        """Generic lifecycle transition helper."""
        check = self.get_object()
        if not check.can_transition_to(new_lifecycle):
            return Response(
                {'error': f'لا يمكن الانتقال من {check.lifecycle} إلى {new_lifecycle}'},
                status=400
            )
        with transaction.atomic():
            check.lifecycle = new_lifecycle
            update_fields = ['lifecycle']
            if timestamp_field:
                setattr(check, timestamp_field, timezone.now())
                update_fields.append(timestamp_field)
            if extra_fields:
                for field, val in extra_fields.items():
                    setattr(check, field, val)
                    update_fields.append(field)
            check.save(update_fields=update_fields)

            # Post ledger entries based on transition
            if new_lifecycle == CheckLifecycle.DEPOSITED:
                LedgerService.record_check_deposit(check, user=request.user)
            elif new_lifecycle == CheckLifecycle.BOUNCED:
                LedgerService.record_check_bounce(check, user=request.user)

        return Response(AdvancedCheckSerializer(check).data)

    @action(detail=True, methods=['post'], url_path='deposit')
    def deposit(self, request, pk=None):
        """Move check from in_wallet → deposited. DR bank → CR checks_wallet."""
        return self._transition(request, pk, CheckLifecycle.DEPOSITED, 'deposited_at')

    @action(detail=True, methods=['post'], url_path='clear')
    def clear(self, request, pk=None):
        """Move check from deposited → cleared (bank accepted it)."""
        return self._transition(request, pk, CheckLifecycle.CLEARED, 'cleared_at')

    @action(detail=True, methods=['post'], url_path='bounce')
    def bounce(self, request, pk=None):
        """Move check from deposited → bounced. Reverse ledger entries."""
        reason = request.data.get('reason', '')
        return self._transition(request, pk, CheckLifecycle.BOUNCED, 'bounced_at',
                                extra_fields={'bounce_reason': reason})

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        """Cancel check while still in wallet."""
        return self._transition(request, pk, CheckLifecycle.CANCELLED)

    @action(detail=False, methods=['get'], url_path='wallet-balance')
    def wallet_balance(self, request):
        """Get total value of checks in wallet by direction."""
        from django.db.models import Sum
        qs = self.get_queryset()
        incoming = qs.filter(lifecycle=CheckLifecycle.IN_WALLET, direction='incoming').aggregate(total=Sum('amount'))
        outgoing = qs.filter(lifecycle=CheckLifecycle.IN_WALLET, direction='outgoing').aggregate(total=Sum('amount'))
        due_soon = qs.filter(
            lifecycle=CheckLifecycle.IN_WALLET,
            due_date__lte=timezone.now().date() + timezone.timedelta(days=7)
        ).values('check_number', 'bank_name', 'due_date', 'amount', 'direction')
        return Response({
            'incoming_total': float(incoming['total'] or 0),
            'outgoing_total': float(outgoing['total'] or 0),
            'due_within_7_days': list(due_soon),
        })
