// Field definitions for BulkImportDialog, per entity.
// `aliases` are matched against spreadsheet headers after normalization
// (lowercased, non-alphanumerics stripped), so "Guardian Phone" ≡ "guardianphone".

export const STUDENT_FIELDS = [
  { key: 'name', label: 'Name', required: true, aliases: ['student name', 'full name', 'student'], example: 'Ram Sharma' },
  { key: 'rollNumber', label: 'Roll Number', aliases: ['roll', 'roll no'], example: '101' },
  { key: 'class', label: 'Class', aliases: ['grade', 'class name'], example: 'Grade 1' },
  { key: 'section', label: 'Section', aliases: [], example: 'A' },
  { key: 'gender', label: 'Gender', aliases: ['sex'], example: 'Male' },
  { key: 'guardianName', label: 'Guardian Name', aliases: ['parent name', 'father name', 'guardian'], example: 'Hari Sharma' },
  { key: 'guardianPhone', label: 'Guardian Phone', aliases: ['phone', 'mobile', 'parent phone', 'contact'], example: '9841000000' },
  { key: 'guardianEmail', label: 'Guardian Email', aliases: ['email', 'parent email'], example: '' },
  { key: 'address', label: 'Address', aliases: [], example: 'Kathmandu' },
  { key: 'dateOfBirth', label: 'Date of Birth', aliases: ['dob', 'birth date'], example: '2015-04-12' },
];

export const SUBJECT_FIELDS = [
  { key: 'name', label: 'Name', required: true, aliases: ['subject', 'subject name'], example: 'Mathematics' },
  { key: 'code', label: 'Code', aliases: ['subject code'], example: 'MATH' },
];

export const BOOK_FIELDS = [
  { key: 'title', label: 'Title', required: true, aliases: ['book', 'book title', 'name'], example: 'Muna Madan' },
  { key: 'author', label: 'Author', aliases: ['writer'], example: 'Laxmi Prasad Devkota' },
  { key: 'isbn', label: 'ISBN', aliases: [], example: '' },
  { key: 'category', label: 'Category', aliases: ['genre', 'type'], example: 'Literature' },
  { key: 'totalCopies', label: 'Total Copies', aliases: ['copies', 'qty', 'quantity'], example: '3' },
  { key: 'shelfLocation', label: 'Shelf Location', aliases: ['shelf', 'location'], example: 'A-12' },
];

export const EMPLOYEE_FIELDS = [
  { key: 'name', label: 'Name', required: true, aliases: ['employee name', 'full name', 'teacher name'], example: 'Sita Adhikari' },
  { key: 'employeeId', label: 'Employee ID', aliases: ['id', 'emp id', 'staff id'], example: 'EMP-001' },
  { key: 'department', label: 'Department', aliases: [], example: 'Science' },
  { key: 'designation', label: 'Designation', aliases: ['position', 'post'], example: 'Teacher' },
  { key: 'phone', label: 'Phone', aliases: ['mobile', 'contact'], example: '9841000000' },
  { key: 'email', label: 'Email', aliases: [], example: '' },
  { key: 'address', label: 'Address', aliases: [], example: 'Lalitpur' },
  { key: 'panNumber', label: 'PAN Number', aliases: ['pan'], example: '' },
  { key: 'dateOfJoining', label: 'Date of Joining', aliases: ['joined', 'join date', 'doj'], example: '2024-01-15' },
  { key: 'basicSalary', label: 'Basic Salary', aliases: ['salary'], example: '35000' },
];

export const CLIENT_FIELDS = [
  { key: 'name', label: 'Name', required: true, aliases: ['client name', 'client', 'company'], example: 'ABC Traders Pvt. Ltd.' },
  { key: 'contactPerson', label: 'Contact Person', aliases: ['contact'], example: 'Gopal KC' },
  { key: 'email', label: 'Email', aliases: [], example: '' },
  { key: 'phone', label: 'Phone', aliases: ['mobile'], example: '9841000000' },
  { key: 'address', label: 'Address', aliases: [], example: 'Kathmandu' },
  { key: 'panVat', label: 'PAN/VAT', aliases: ['pan', 'vat'], example: '' },
  { key: 'notes', label: 'Notes', aliases: ['remarks'], example: '' },
];

export const VENDOR_FIELDS = [
  { key: 'name', label: 'Name', required: true, aliases: ['vendor name', 'vendor', 'supplier', 'company'], example: 'XYZ Suppliers' },
  { key: 'contactPerson', label: 'Contact Person', aliases: ['contact'], example: 'Bina Thapa' },
  { key: 'email', label: 'Email', aliases: [], example: '' },
  { key: 'phone', label: 'Phone', aliases: ['mobile'], example: '9841000000' },
  { key: 'address', label: 'Address', aliases: [], example: 'Bhaktapur' },
  { key: 'panVat', label: 'PAN/VAT', aliases: ['pan', 'vat'], example: '' },
  { key: 'notes', label: 'Notes', aliases: ['remarks'], example: '' },
];

export const INVENTORY_FIELDS = [
  { key: 'itemName', label: 'Item Name', required: true, aliases: ['item', 'name', 'product'], example: 'A4 Paper Ream' },
  { key: 'partNumber', label: 'Part Number', aliases: ['part', 'sku', 'code'], example: '' },
  { key: 'brand', label: 'Brand', aliases: [], example: '' },
  { key: 'description', label: 'Description', aliases: [], example: '' },
  { key: 'unit', label: 'Unit', aliases: ['uom'], example: 'PCS' },
  { key: 'quantity', label: 'Quantity', aliases: ['qty', 'stock'], example: '50' },
  { key: 'unitPurchasePrice', label: 'Purchase Price', aliases: ['cost price', 'cost'], example: '450' },
  { key: 'unitSellingPrice', label: 'Selling Price', aliases: ['price', 'rate'], example: '520' },
  { key: 'stockLocation', label: 'Stock Location', aliases: ['location'], example: '' },
  { key: 'lowStockThreshold', label: 'Low Stock Threshold', aliases: ['min stock', 'reorder level'], example: '5' },
];
