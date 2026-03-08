import re
import json

filepath = r"d:\ورشة يحيى\saas-dashboard\frontend\src\i18n.js"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

updates = {
    "activeWorking": "متاح للعمل (على رأس عمله)",
    "onLeaveInactive": "في إجازة/قيد التوقف",
    "title": "نظرة عامة على الموارد البشرية",
    "subtitle": "المقاييس الرئيسية لأداء الأعمال والقوى العاملة",
    "btnRefresh": "تحديث",
    "btnAddEmployee": "إضافة موظف",
    "totalHeadcount": "إجمالي القوى العاملة",
    "presentToday": "حاضرون اليوم",
    "lateToday": "التأخيرات اليوم",
    "absentToday": "الغياب اليوم",
    "pendingLeaves": "إجازات معلقة",
    "estPayroll": "الرواتب التقديرية (ألف)",
    "departmentDistribution": "توزيع الموظفين على الأقسام",
    "recentLeaveRequests": "طلبات الإجازة الأخيرة",
    "totalLabel": "المجموع",
    "daysLabel": "أيام",
    "requestedAgo": "تم الطلب منذ",
    "btnApprove": "موافقة",
    "btnReject": "رفض",
    "workforceUtilization": "استغلال القوى العاملة",
    "activeLabel": "متوفر الان",
    "liveAvailabilityScore": "نسبة الجاهزية التشغيلية المباشرة",
    "liveAvailabilityDesc": "النسبة المئوية للقوى العاملة المطلوبة والمتاحة الآن للإنتاج الفعلي.",
    "operationalText": "تشغيلي بالكامل",
    "employeeDirectory": "دليل الموظفين المتقدم",
    "searchEmployeePlaceholder": "البحث باسم الموظف أو رمزه...",
    "allDepts": "جميع الأقسام",
    "allRoles": "جميع الوظائف",
    "allStatus": "كل الحالات",
    "modalEditPointageTitle": "تعديل السجل المتجاوز",
    "modalMarkAttendanceTitle": "بصمة حضور تجاوزي يدوي",
    "lblSelectTime": "حدد وقت الحدث بدقة متناهية",
    "btnSavePointage": "اعتماد السجل",
    "btnClear": "مسح الحركة",
    "colWorkedTime": "وقت العمل الإجمالي",
    "colLateOvertime": "التأخير / العمل الإضافي",
    "colBaseSalary": "الراتب الأساسي",
    "colDeductionsTotal": "إجمالي الخصومات",
    "colOvertimeAddition": "إضافة العمل الإضافي",
    "colFinalClearedSalary": "الراتب النهائي المصفى",
    "colTotalLateMissedMin": "إجمالي الدقائق الضائعة (التأخير والغياب)",
    "colLossLateness": "خسارة الرواتب (تأخيرات)",
    "colLossAbsence": "خسارة الرواتب (أيام الغياب)",
    "colTotalLiabilityDeducted": "إجمالي الالتزامات المخصومة",
    "colDaysWithOvertime": "أيام مع عمل إضافي",
    "colTotalExtraMinutes": "إجمالي الدقائق الإضافية",
    "pdfDaily": "PDF اليومي",
    "pdfMonthly": "PDF الشهري",
    "pdfPayroll": "PDF الرواتب",
    "pdfOvertime": "PDF العمل الإضافي",
    "pdfDeductions": "PDF الخصومات",
    "colRole": "المسمى الوظيفي",
    "colDaysPresent": "أيام الحضور",
    "colLateDays": "أيام التأخير",
    "colAbsentDays": "أيام الغياب",
    "colTotalMissingMins": "إجمالي الدقائق المفقودة",
    "colEstSalary": "الراتب المقدر",
    "unknown": "غير متاح",
    "reportsTitle": "تقارير الموارد البشرية التحليلية",
    "reportsSubtitle": "تصدير وتحليل كل بيانات الحضور، لوائح الرواتب والعمل الإضافي بصيغ قابلة للقراءة.",
    "btnExcel": "تصدير بصيغة حصد بيانات",
    "btnPdf": "جدول موثول و قابل للطباعة",
    "reportDailyTitle": "سجل الحركة اليومية للحضور والانصراف",
    "reportDailyDesc": "حركة دخول وخروج الموظفين كافة في تاريخ محدد مفصلة بالدقيقة وحساب الانحرافات عن المعيار.",
    "reportMonthlyTitle": "كشف الحضور الشهري الإجمالي",
    "reportMonthlyDesc": "مصفوفة تحليلية تبين حصيلة أيام العمل التامة، مجموع ساعات التأخير، وكم الغياب الفعلي عن الحصص.",
    "reportPayrollTitle": "سرح رواتب وحوافز الاستحقاقات الشهرية",
    "reportPayrollDesc": "القائمة الرسمية للأجر الأساسي شاملة أي تخفيضات متعلقة بالوقت الضائع والإضافات المسجلة.",
    "reportOvertimeTitle": "سجل تتبع أوقات العمل الإضافية التراكمية",
    "reportOvertimeDesc": "تفاصيل الدقائق المستقطعة بالعمل الإضافي ليلاً ونهاراً والتي تفوق حد النصاب الرسمي للإنتاج.",
    "reportDeductionsTitle": "مصفوفة التخفيضات والوقت المفقد للشركة",
    "reportDeductionsDesc": "تحليل تكلفة كل دقيقة مفقودة على الرواتب نتيجة التأخير والغياب بدون حجة قُبالة العمال المنفردين.",
    "reportExtract": "طلب الاستخراج الآلي للتقرير",
    "lblParameters": "محددات الفترة لبيانات التقرير",
    "resultsGenerated": "النتائج معالجة ومتاحة للعرض والتحميل",
    "monthlyMatrixReady": "تم إغلاق دورة الحساب، المصفوفة الشهرية للتحليل جاهزة للعرض.",
    "monthlyMatrixExcelNotice": "يمكنك إجراء تحليلات الجدول المحوري ونقاط التقاطع في Excel بنقرة واحدة.",
    "btnExportCsvXlsx": "تحضير للتحميل إلى الإكسل"
}

# Find ar.translation block
start_transl = content.find("        translation: {", content.find("ar: {"))
end_transl = content.find("\n        },\n        settingsGeneral:", start_transl)

# Extract translation slice
if start_transl != -1 and end_transl != -1:
    transl_content = content[start_transl:end_transl]
    
    # We want to replace inside transl_content
    # Find hr: {
    hr_start = transl_content.find("hr: {", transl_content.find("projects_portfolio:"))
    hr_end = transl_content.find("\n            },", hr_start)
    
    if hr_start != -1 and hr_end != -1:
        hr_content = transl_content[hr_start:hr_end]
        
        # Replace keys
        for key, val in updates.items():
            # Match either unquoted or quote key
            pattern = re.compile(rf'({key}"?\s*:\s*")(.*?)(")', re.MULTILINE)
            # if key is not found, maybe append it at the end?
            if pattern.search(hr_content):
                hr_content = pattern.sub(rf'\g<1>{val}\g<3>', hr_content)
            else:
                hr_content += f',\n                {key}: "{val}"'

        transl_content = transl_content[:hr_start] + hr_content + transl_content[hr_end:]
        content = content[:start_transl] + transl_content + content[end_transl:]
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Success: Updated keys.")
    else:
        print("Failed to find hr in transl")
else:
    print("Failed to find transl")
