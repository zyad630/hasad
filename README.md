# نظام الحِسبة SaaS (Hisba SaaS)

نظام إدارة محاسبية سحابي (SaaS) متخصص في إدارة محلات الحِسبة (الكمسيون) بسوق الخضار. يعتمد على بنية Multi-Tenant تفصل البيانات أمنياً، ليتيح إدارة مركزية (Super Admin) ونسخ تجريبية لعملائك بطريقة تلقائية.

---

## 📅 مخرجات الأسبوع الأول (Week 1 Features Only) 
تم اكتمال النقاط الست الأساسية للأسبوع الأول بدون إدراج عمليات الأسبوع الثاني (التصفيات والمبيعات)، كالآتي:

1. **إعداد البنية السحابية SaaS Core**:
   - بيئة عمل Django + DRF ومصممة لتعمل مع قواعد PostgreSQL بصيغة Docker، ومع عزل قواعد البيانات برمجياً (TenantMiddleware يعمل بالـ Subdomain من الـ Request).
2. **لوحة تحكم إدارة النظام (Super Admin)**:
   - نظام يعالج فحص الاشتراكات آلياً عبر `Celery Task` مضافة إلى `core/tasks.py` (`check_trial_expirations`) لتفقد الحسابات التجريبية كل يوم الساعة 12:05 صباحاً.
   - واجهة Frontend مسؤولة (src/pages/superadmin/TenantsList.tsx) مخصصة فقط لمدير النظام (Super Admin) تسرد الإحصائيات (عدد العملاء والمشتركين النشطين وفترة التجربة)، مع نموذج إنشاء آلي (Trial).
3. **إدارة الموردين والعملاء (Suppliers & Customers)**:
   - واجهة أمامية وقواعد بيانات تدير حسابات الموردين سواء حسبة (عمولة نسبة مئوية، عمولة ثابتة) أو المشتريات المباشرة. 
4. **إدارة الأصناف وجدول التحويل الدقيق (Inventory & Items)**:
   - نظام متكامل (Item, UnitConversion) في الخلفية والواجهة لتعريف الصنف وتحديد وحدة استلامه الافتراضية، بالإضافة إلى سجلات لنسبة الهالك.
5. **إدخال الإرساليات (Shipments Core)**:
   - صفحة للمستخدم تسجل فاتورة المورد، وتضع الروابط الأصلية للأصناف وتفرغها في (ShipmentItem).
6. **النسخ التجريبية التلقائية والـ Tasks**:
   - تسجيل الدخول للعميل الجديد يولد له تاريخ انتهاء Trial_ends_at = Now + 14 Days. يتم تفقدها كما تم شرحه عبر الـ Celery.

---

## 🛠️ كيف تبدأ (How to Run)

### في حال أردت تجربة النظام (Frontend+Backend):

#### 1. خادم الخلفية (Backend) - Django API
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate

# (اختياري) تشغيل Celery worker للمهام المجدولة (على Window يتطلب celery -A hisba_backend worker -l info -P solo)
python manage.py runserver
```

#### 2. واجهة التطبيق (Frontend) - Vite + React
```bash
cd frontend
npm install
npm run dev
```

*يجب رفع الخادمين لكي يعمل الـ Auth API لـ RTK Query.*

## 🧪 فحص النظام واختباراته للمرحلة الأولى (Tests)
قمت بإدراج اختبارات قوية عبر Django `TestCase` في ملف `core/tests.py`:
- `test_trial_expiration_task`: لاختبار وفحص وظيفة الـ Trial expiration عبر الـ Celery والآلية.
- تعمل الاختبارات بتنفيذ الأمر `python manage.py test core` داخل مجلد الـ backend.
