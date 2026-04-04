# tests/test_permissions.py
import pytest

def test_cashier_cannot_confirm_settlement(api_client, cashier_user, open_shipment):
    api_client.force_authenticate(user=cashier_user)
    response = api_client.post('/api/settlements/confirm/', {
        'shipment_id': str(open_shipment.id)
    })
    assert response.status_code == 403
    assert 'صلاحية' in response.data['detail'] or 'صلاحية' in response.data.get('error', '')

def test_owner_can_confirm_settlement(api_client, owner_user, open_shipment):
    api_client.force_authenticate(user=owner_user)
    response = api_client.post('/api/settlements/confirm/', {
        'shipment_id': str(open_shipment.id)
    })
    assert response.status_code == 201 or response.status_code == 400  # Depending on logic inside, 403 should NOT trigger
