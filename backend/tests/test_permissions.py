import pytest
from rest_framework.test import APIClient
from core.models import Tenant, CustomUser
from suppliers.models import Supplier, DealType, CommissionType
from inventory.models import Shipment
from django.utils import timezone
from decimal import Decimal
from rest_framework_simplejwt.tokens import RefreshToken

@pytest.fixture
def db_setup(db):
    tenant = Tenant.objects.create(name='Test', subdomain='test')
    ct = CommissionType.objects.create(tenant=tenant, name="per", calc_type="percent", default_rate=Decimal("10.00"))
    sup = Supplier.objects.create(tenant=tenant, name="s1", deal_type="commission", commission_type=ct)
    ship = Shipment.objects.create(tenant=tenant, supplier=sup, shipment_date=timezone.now().date())
    
    cashier = CustomUser.objects.create_user(username='cash1', password='123', tenant=tenant, role='cashier')
    owner = CustomUser.objects.create_user(username='own1', password='123', tenant=tenant, role='owner')
    
    return {'tenant': tenant, 'ship': ship, 'cashier': cashier, 'owner': owner}

@pytest.fixture
def api_client():
    return APIClient()

@pytest.mark.django_db
def test_cashier_cannot_confirm_settlement(api_client, db_setup):
    api_client.force_authenticate(user=db_setup['cashier'])
    response = api_client.post('/api/settlements/confirm/', {
        'shipment_id': str(db_setup['ship'].id)
    }, format='json', HTTP_HOST='test.localhost:8000')
    assert response.status_code == 403
    assert 'صلاحية' in str(response.data)

@pytest.mark.django_db
def test_owner_can_confirm_settlement(api_client, db_setup):
    api_client.force_authenticate(user=db_setup['owner'])
    response = api_client.post('/api/settlements/confirm/', {
        'shipment_id': str(db_setup['ship'].id)
    }, format='json', HTTP_HOST='test.localhost:8000')
    # Because there are no shipment items or sales, the engine logic might return 400. 
    # That is perfectly fine, we are only testing that we bypassed the 403 PermissionDenied.
    assert response.status_code in [201, 400]


@pytest.mark.django_db
def test_cross_tenant_jwt_is_rejected():
    tenant_a = Tenant.objects.create(name='Tenant A', subdomain='alpha')
    tenant_b = Tenant.objects.create(name='Tenant B', subdomain='beta')

    ct_a = CommissionType.objects.create(tenant=tenant_a, name="per-a", calc_type="percent", default_rate=Decimal("10.00"))
    sup_a = Supplier.objects.create(tenant=tenant_a, name="sup-a", deal_type="commission", commission_type=ct_a)
    ship_a = Shipment.objects.create(tenant=tenant_a, supplier=sup_a, shipment_date=timezone.now().date())

    user_b = CustomUser.objects.create_user(username='owner-b', password='123', tenant=tenant_b, role='owner')
    access = str(RefreshToken.for_user(user_b).access_token)

    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    response = client.post(
        '/api/settlements/confirm/',
        {'shipment_id': str(ship_a.id)},
        format='json',
        HTTP_HOST='alpha.example.com:8000',
    )

    assert response.status_code == 401
    assert 'Cross-tenant access denied.' in str(response.data)
