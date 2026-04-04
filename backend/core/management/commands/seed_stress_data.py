import random
import uuid
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta
from faker import Faker
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction

from core.models import Tenant, AuditLog, CustomUser
from suppliers.models import Supplier, Customer
from inventory.models import Category, Item, Shipment, ShipmentItem
from finance.models import CashTransaction, Settlement, Expense
from sales.models import Sale, SaleItem, ContainerTransaction

fake = Faker('ar_EG')
TWO_PLACES = Decimal('0.01')

class Command(BaseCommand):
    help = 'Seeds the database with massive realistic stress-testing data'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting Stress Data Seeding. This will wipe existing data in testing environments gracefully (optional)..."))

        tenant_configs = [
            ("محلات النور للكمسيون (فرع صغير)", "small"),
            ("مؤسسة التوحيد لتجارة الجملة (متوسطة)", "medium"),
            ("شادر المعلم إبراهيم الرئيسي (فرع ضخم)", "large"),
        ]

        with transaction.atomic():
            for name, subdomain in tenant_configs:
                self.stdout.write(f"--> Seeding Tenant: {name}")
                tenant, _ = Tenant.objects.get_or_create(subdomain=subdomain, defaults={'name': name, 'status': 'active'})
                user, _ = CustomUser.objects.get_or_create(username=f"{subdomain}_admin", defaults={'tenant': tenant, 'role': 'owner'})
                
                self.seed_tenant_data(tenant, user)
                
        self.stdout.write(self.style.SUCCESS('Successfully seeded massive stress data!'))

    def seed_tenant_data(self, tenant, user):
        now = timezone.now()
        start_date = now - timedelta(days=180)
        
        # 1. Categories & Items (30 items)
        cat_veg, _ = Category.objects.get_or_create(tenant=tenant, name="خضروات")
        cat_fruit, _ = Category.objects.get_or_create(tenant=tenant, name="فواكه")
        
        base_items = ["طماطم", "خيار", "بصل", "بطاطس", "فلفل", "باذنجان", "ليمون", "جزر", "ملفوف", "كوسة",
                      "تفاح", "موز", "مانجو", "برتقال", "عنب", "خوخ", "مشمش", "بطيخ", "يوسفي", "رمان"]
        items = []
        for i in range(30):
            name = f"{random.choice(base_items)} {fake.word()}"
            item, _ = Item.objects.get_or_create(
                tenant=tenant, 
                name=name, 
                defaults={
                    'category': cat_veg if i < 15 else cat_fruit,
                    'base_unit': random.choice(['kg', 'box', 'sack']),
                    'waste_percentage': Decimal(random.randint(1, 10))
                }
            )
            items.append(item)

        # 2. Suppliers (50)
        suppliers = []
        for _ in range(50):
            sup = Supplier.objects.create(
                tenant=tenant,
                name=fake.company(),
                phone=fake.phone_number()[:15],
                deal_type=random.choice(['commission', 'direct_buy']),
                commission_type=random.choice(['percent', 'fixed']),
                commission_rate=Decimal(str(random.randint(5, 10)))
            )
            suppliers.append(sup)
            
        # 3. Customers (200)
        customers = []
        for _ in range(200):
            cust = Customer.objects.create(
                tenant=tenant,
                name=fake.name(),
                phone=fake.phone_number()[:15],
                credit_balance=Decimal('0.00')
            )
            customers.append(cust)

        # 4. Shipments (500)
        shipments = []
        ship_items_pool = []
        for i in range(500):
            ship_date = start_date + timedelta(days=random.randint(0, 180))
            ship = Shipment.objects.create(
                tenant=tenant,
                supplier=random.choice(suppliers),
                shipment_date=ship_date.date(),
                status='received'
            )
            shipments.append(ship)
            
            # 2 to 5 items per shipment
            for _ in range(random.randint(2, 5)):
                qty = Decimal(str(random.randint(500, 5000)))
                si = ShipmentItem.objects.create(
                    shipment=ship,
                    item=random.choice(items),
                    unit='kg',
                    quantity=qty,
                    remaining_qty=qty
                )
                ship_items_pool.append(si)

        # 5. Sales (5000)
        # We need realistic deduction from ship_items.
        sales = []
        sales_items = []
        cash_tx_creates = []
        for i in range(5000):
            sale_date = start_date + timedelta(days=random.randint(0, 180))
            customer = random.choice(customers)
            payment_type = random.choice(['cash', 'credit'])
            
            total_amt = Decimal('0.00')
            
            # Select random item with remaining_qty
            avail_items = [si for si in ship_items_pool if si.remaining_qty > 0]
            if not avail_items:
                break
                
            chosen_si = random.choice(avail_items)
            sale_qty = min(Decimal(str(random.randint(10, 200))), chosen_si.remaining_qty)
            unit_price = Decimal(str(random.randint(5, 30))).quantize(TWO_PLACES)
            subtotal = (sale_qty * unit_price).quantize(TWO_PLACES)
            
            chosen_si.remaining_qty -= sale_qty
            total_amt += subtotal
            
            sale = Sale.objects.create(
                tenant=tenant,
                customer=customer,
                payment_type=payment_type,
                total_amount=total_amt,
                sale_date=sale_date
            )
            
            SaleItem.objects.create(
                sale=sale,
                shipment_item=chosen_si,
                quantity=sale_qty,
                unit_price=unit_price,
                subtotal=subtotal
            )
            
            if payment_type == 'credit':
                customer.credit_balance = (Decimal(str(customer.credit_balance)) + total_amt).quantize(TWO_PLACES)
            
            cash_tx_creates.append(CashTransaction(
                tenant=tenant, tx_type='in', amount=total_amt if payment_type == 'cash' else Decimal('0.00'),
                reference_type='sale', reference_id=sale.id, description=f"فاتورة {payment_type} - {i}", tx_date=sale_date
            ))
            
        Customer.objects.bulk_update(customers, ['credit_balance'])
        ShipmentItem.objects.bulk_update(ship_items_pool, ['remaining_qty'])
        CashTransaction.objects.bulk_create(cash_tx_creates)

        # 6. Settlements (1000)
        settlable = shipments[:1000] if len(shipments) >= 1000 else shipments
        settlements_to_create = []
        for ship in settlable:
            if ship.status != 'received': continue
            
            # manual calc for speed as we bypassed services for raw bulk insertion
            total_sales = Decimal(str(random.randint(500, 10000))).quantize(TWO_PLACES)
            comm = (total_sales * Decimal('0.05')).quantize(TWO_PLACES)
            net_sup = total_sales - comm
            
            settlements_to_create.append(Settlement(
                tenant=tenant, shipment=ship, supplier=ship.supplier,
                total_sales=total_sales, commission_amount=comm,
                total_expenses=Decimal('0.00'), net_supplier=net_sup,
                settled_at=now
            ))
            ship.status = 'settled'
            ship.supplier.balance = (Decimal(str(ship.supplier.balance)) - net_sup).quantize(TWO_PLACES)
            
        Settlement.objects.bulk_create(settlements_to_create)
        Shipment.objects.bulk_update(settlable, ['status'])
        Supplier.objects.bulk_update(suppliers, ['balance'])

        # 7. Extra Cash Transactions (2000)
        extra_cash = []
        for i in range(2000):
            amt = Decimal(str(random.randint(50, 5000))).quantize(TWO_PLACES)
            extra_cash.append(CashTransaction(
                tenant=tenant,
                tx_type=random.choice(['in', 'out']),
                amount=amt,
                reference_type='other',
                description=fake.sentence(),
                tx_date=start_date + timedelta(days=random.randint(0, 180))
            ))
        CashTransaction.objects.bulk_create(extra_cash)
        
        # 8. Container Transactions (800)
        containers = []
        for i in range(800):
            containers.append(ContainerTransaction(
                tenant=tenant,
                customer=random.choice(customers),
                container_type='صندوق بلاستيك',
                direction=random.choice(['in', 'out']),
                quantity=random.randint(5, 50),
                tx_date=start_date + timedelta(days=random.randint(0, 180))
            ))
        ContainerTransaction.objects.bulk_create(containers)
