from rest_framework import serializers
from .models import Employee, PayrollRun, PayrollLine


class EmployeeSerializer(serializers.ModelSerializer):
    daily_rate = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'name', 'national_id', 'phone', 'job_title',
            'basic_salary', 'working_days_per_month', 'daily_rate',
            'hire_date', 'status', 'notes',
        ]
        read_only_fields = ['id']

    def get_daily_rate(self, obj):
        return float(obj.daily_rate())


class PayrollLineSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.name', read_only=True)

    class Meta:
        model = PayrollLine
        fields = [
            'id', 'employee', 'employee_name',
            'days_worked', 'basic_salary', 'deductions', 'bonuses',
            'net_salary', 'ledger_posted',
        ]
        read_only_fields = ['id', 'net_salary', 'ledger_posted']


class PayrollRunSerializer(serializers.ModelSerializer):
    lines       = PayrollLineSerializer(many=True, read_only=True)
    total_net   = serializers.SerializerMethodField()

    class Meta:
        model = PayrollRun
        fields = ['id', 'period', 'run_date', 'is_posted', 'notes', 'lines', 'total_net', 'created_at']
        read_only_fields = ['id', 'is_posted', 'created_at']

    def get_total_net(self, obj):
        return float(sum(l.net_salary for l in obj.lines.all()))
