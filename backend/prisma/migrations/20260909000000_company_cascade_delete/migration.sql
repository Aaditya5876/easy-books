-- Deleting a company (Settings -> Companies/Clients -> Delete) was silently
-- broken for any company with real data: 54 of the ~55 tables that reference
-- companyId had no ON DELETE CASCADE, so Postgres rejected the delete with a
-- foreign key violation the moment the company had even one employee,
-- student, transaction, etc. Only a brand-new, completely empty company could
-- ever actually be deleted. This adds cascade delete to every one of them, so
-- "Delete" actually does what its own confirmation dialog already promises
-- ("This permanently deletes the company and cannot be undone").

-- DropForeignKey
ALTER TABLE "academic_years" DROP CONSTRAINT "academic_years_companyId_fkey";
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_companyId_fkey";
ALTER TABLE "bank_accounts" DROP CONSTRAINT "bank_accounts_companyId_fkey";
ALTER TABLE "bank_guarantees" DROP CONSTRAINT "bank_guarantees_companyId_fkey";
ALTER TABLE "book_issues" DROP CONSTRAINT "book_issues_companyId_fkey";
ALTER TABLE "books" DROP CONSTRAINT "books_companyId_fkey";
ALTER TABLE "cheques" DROP CONSTRAINT "cheques_companyId_fkey";
ALTER TABLE "clients" DROP CONSTRAINT "clients_companyId_fkey";
ALTER TABLE "company_payroll_settings" DROP CONSTRAINT "company_payroll_settings_companyId_fkey";
ALTER TABLE "credit_notes" DROP CONSTRAINT "credit_notes_companyId_fkey";
ALTER TABLE "debit_notes" DROP CONSTRAINT "debit_notes_companyId_fkey";
ALTER TABLE "employees" DROP CONSTRAINT "employees_companyId_fkey";
ALTER TABLE "exam_results" DROP CONSTRAINT "exam_results_companyId_fkey";
ALTER TABLE "exam_schedules" DROP CONSTRAINT "exam_schedules_companyId_fkey";
ALTER TABLE "exams" DROP CONSTRAINT "exams_companyId_fkey";
ALTER TABLE "fee_heads" DROP CONSTRAINT "fee_heads_companyId_fkey";
ALTER TABLE "fee_invoices" DROP CONSTRAINT "fee_invoices_companyId_fkey";
ALTER TABLE "fee_packages" DROP CONSTRAINT "fee_packages_companyId_fkey";
ALTER TABLE "fee_payments" DROP CONSTRAINT "fee_payments_companyId_fkey";
ALTER TABLE "fee_structures" DROP CONSTRAINT "fee_structures_companyId_fkey";
ALTER TABLE "fiscal_year_closes" DROP CONSTRAINT "fiscal_year_closes_companyId_fkey";
ALTER TABLE "fixed_assets" DROP CONSTRAINT "fixed_assets_companyId_fkey";
ALTER TABLE "homeworks" DROP CONSTRAINT "homeworks_companyId_fkey";
ALTER TABLE "hostel_allocations" DROP CONSTRAINT "hostel_allocations_companyId_fkey";
ALTER TABLE "hostel_rooms" DROP CONSTRAINT "hostel_rooms_companyId_fkey";
ALTER TABLE "inventory_adjustments" DROP CONSTRAINT "inventory_adjustments_companyId_fkey";
ALTER TABLE "inventory_items" DROP CONSTRAINT "inventory_items_companyId_fkey";
ALTER TABLE "leave_types" DROP CONSTRAINT "leave_types_companyId_fkey";
ALTER TABLE "ledger_accounts" DROP CONSTRAINT "ledger_accounts_companyId_fkey";
ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_companyId_fkey";
ALTER TABLE "memo_documents" DROP CONSTRAINT "memo_documents_companyId_fkey";
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_companyId_fkey";
ALTER TABLE "payments" DROP CONSTRAINT "payments_companyId_fkey";
ALTER TABLE "payrolls" DROP CONSTRAINT "payrolls_companyId_fkey";
ALTER TABLE "petty_cash_vouchers" DROP CONSTRAINT "petty_cash_vouchers_companyId_fkey";
ALTER TABLE "portal_notifications" DROP CONSTRAINT "portal_notifications_companyId_fkey";
ALTER TABLE "portal_users" DROP CONSTRAINT "portal_users_companyId_fkey";
ALTER TABLE "purchase_orders" DROP CONSTRAINT "purchase_orders_companyId_fkey";
ALTER TABLE "quotations" DROP CONSTRAINT "quotations_companyId_fkey";
ALTER TABLE "sales_orders" DROP CONSTRAINT "sales_orders_companyId_fkey";
ALTER TABLE "school_classes" DROP CONSTRAINT "school_classes_companyId_fkey";
ALTER TABLE "school_events" DROP CONSTRAINT "school_events_companyId_fkey";
ALTER TABLE "school_notices" DROP CONSTRAINT "school_notices_companyId_fkey";
ALTER TABLE "student_attendances" DROP CONSTRAINT "student_attendances_companyId_fkey";
ALTER TABLE "student_scholarships" DROP CONSTRAINT "student_scholarships_companyId_fkey";
ALTER TABLE "student_transports" DROP CONSTRAINT "student_transports_companyId_fkey";
ALTER TABLE "students" DROP CONSTRAINT "students_companyId_fkey";
ALTER TABLE "study_materials" DROP CONSTRAINT "study_materials_companyId_fkey";
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_companyId_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_companyId_fkey";
ALTER TABLE "timetable_entries" DROP CONSTRAINT "timetable_entries_companyId_fkey";
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_companyId_fkey";
ALTER TABLE "transport_routes" DROP CONSTRAINT "transport_routes_companyId_fkey";
ALTER TABLE "vendors" DROP CONSTRAINT "vendors_companyId_fkey";

-- AddForeignKey
ALTER TABLE "fiscal_year_closes" ADD CONSTRAINT "fiscal_year_closes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_payroll_settings" ADD CONSTRAINT "company_payroll_settings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_guarantees" ADD CONSTRAINT "bank_guarantees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "petty_cash_vouchers" ADD CONSTRAINT "petty_cash_vouchers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memo_documents" ADD CONSTRAINT "memo_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_classes" ADD CONSTRAINT "school_classes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portal_notifications" ADD CONSTRAINT "portal_notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_heads" ADD CONSTRAINT "fee_heads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_structures" ADD CONSTRAINT "fee_structures_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_invoices" ADD CONSTRAINT "fee_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_payments" ADD CONSTRAINT "fee_payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_scholarships" ADD CONSTRAINT "student_scholarships_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_packages" ADD CONSTRAINT "fee_packages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exams" ADD CONSTRAINT "exams_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "academic_years" ADD CONSTRAINT "academic_years_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_attendances" ADD CONSTRAINT "student_attendances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timetable_entries" ADD CONSTRAINT "timetable_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_notices" ADD CONSTRAINT "school_notices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "books" ADD CONSTRAINT "books_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_issues" ADD CONSTRAINT "book_issues_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transport_routes" ADD CONSTRAINT "transport_routes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_transports" ADD CONSTRAINT "student_transports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
