from rest_framework import status, viewsets, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.utils import timezone
from datetime import timedelta
from .models import Tenant, CustomUser
from .serializers import (
    TenantSerializer, CustomUserSerializer,
    LoginSerializer, ChangePasswordSerializer, RegisterTenantSerializer
)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password']
        )
        if not user:
            return Response({'detail': 'بيانات الدخول غير صحيحة'}, status=status.HTTP_401_UNAUTHORIZED)
        if not user.is_active:
            return Response({'detail': 'الحساب معطل'}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': CustomUserSerializer(user).data,
        })


class MeView(APIView):
    def get(self, request):
        return Response(CustomUserSerializer(request.user).data)


class ChangePasswordView(APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data['old_password']):
            return Response({'detail': 'كلمة المرور القديمة غير صحيحة'}, status=400)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.save()
        return Response({'detail': 'تم تغيير كلمة المرور بنجاح'})


class TenantViewSet(viewsets.ModelViewSet):
    """Super Admin only tenant management."""
    serializer_class = TenantSerializer
    queryset = Tenant.objects.all()

    def get_permissions(self):
        return [permissions.IsAdminUser()]

    def perform_create(self, serializer):
        tenant = serializer.save(
            status='trial',
            trial_ends_at=timezone.now() + timedelta(days=14)
        )
        return tenant


class RegisterTenantView(APIView):
    """Super Admin creates new tenant + owner user."""
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        serializer = RegisterTenantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        if Tenant.objects.filter(subdomain=d['subdomain']).exists():
            return Response({'detail': 'الـ subdomain مستخدم مسبقاً'}, status=400)
        if CustomUser.objects.filter(username=d['owner_username']).exists():
            return Response({'detail': 'اسم المستخدم مستخدم مسبقاً'}, status=400)

        tenant = Tenant.objects.create(
            name=d['tenant_name'],
            subdomain=d['subdomain'],
            status='trial',
            trial_ends_at=timezone.now() + timedelta(days=14),
        )
        owner = CustomUser.objects.create_user(
            username=d['owner_username'],
            password=d['owner_password'],
            tenant=tenant,
            role='owner',
            is_staff=False,
        )
        return Response({
            'tenant': TenantSerializer(tenant).data,
            'owner': CustomUserSerializer(owner).data,
        }, status=201)


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = CustomUserSerializer

    def get_queryset(self):
        return CustomUser.objects.filter(tenant=self.request.tenant)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.tenant)
