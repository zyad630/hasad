import requests
from django.conf import settings
from suppliers.models import Supplier, Customer
from finance.models import LedgerEntry
from decimal import Decimal

class WhatsAppBotService:
    @staticmethod
    def handle_message(sender_phone, text):
        """
        Main entry point for incoming WhatsApp messages.
        """
        # 1. Clean phone (remove '+' if exists)
        phone = sender_phone.replace('+', '')
        
        # 2. Identify the person
        person = None
        is_supplier = False
        
        customer = Customer.objects.filter(phone__icontains=phone[-9:]).first() # Match last 9 digits
        if customer:
            person = customer
        else:
            supplier = Supplier.objects.filter(phone__icontains=phone[-9:]).first()
            if supplier:
                person = supplier
                is_supplier = True
        
        if not person:
            return "عذراً، رقم هاتفك غير مسجل في نظام حصاد. يرجى التواصل مع إدارة الحسبة."

        clean_text = text.strip()
        
        # 3. Handle Keywords
        if "كشف حساب" in clean_text:
            return WhatsAppBotService.get_ledger_summary(person, is_supplier)
        
        if "رصيد" in clean_text:
            balance = LedgerEntry.get_balance(person.tenant, 'supplier' if is_supplier else 'customer', person.id)
            return f"مرحباً {person.name}، رصيدك الحالي هو: {balance} ₪"

        return f"مرحباً {person.name}، أنا بوت نظام حصاد. \nيمكنك طلب (كشف حساب) أو (رصيد) عبر الواتساب."

    @staticmethod
    def get_ledger_summary(person, is_supplier):
        account_type = 'supplier' if is_supplier else 'customer'
        balance = LedgerEntry.get_balance(person.tenant, account_type, person.id)
        
        entries = LedgerEntry.objects.filter(
            tenant=person.tenant,
            account_type=account_type,
            account_id=person.id
        ).order_by('-entry_date')[:5] # Last 5 transactions
        
        msg = f"📋 كشف حساب مختصر لـ {person.name}:\n"
        msg += f"💰 الرصيد الحالي: {balance} ₪\n\n"
        msg += "🕒 آخر 5 حركات:\n"
        
        for entry in entries:
            type_symbol = "➕" if entry.entry_type == 'CR' else "➖"
            msg += f"{type_symbol} {entry.amount} | {entry.description}\n"
        
        msg += "\nللحصول على كشف كامل PDF، يرجى طلب ذلك من الإدارة."
        return msg

    @staticmethod
    def send_message(phone, text):
        """
        Sends a WhatsApp message via Meta Cloud API.
        """
        token = getattr(settings, 'WA_TOKEN', '')
        phone_id = getattr(settings, 'WA_PHONE_ID', '')
        
        if not token or not phone_id:
            print("Warning: WhatsApp credentials not found.")
            return False
            
        url = f"https://graph.facebook.com/v17.0/{phone_id}/messages"
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        data = {
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": text}
        }
        
        response = requests.post(url, headers=headers, json=data)
        return response.status_code == 200
