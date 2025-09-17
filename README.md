# 🚀 IPL Management System

A comprehensive web application for managing IPL (Iuran Pemeliharaan Lingkungan) payments with full authentication and user management capabilities. Built with modern technologies and designed for efficient community management.

## ✨ Technology Stack

This application provides a robust foundation built with:

### 🎯 Core Framework
- **⚡ Next.js 15** - The React framework for production with App Router
- **📘 TypeScript 5** - Type-safe JavaScript for better developer experience
- **🎨 Tailwind CSS 4** - Utility-first CSS framework for rapid UI development

### 🔐 Authentication & Security
- **🔐 bcryptjs** - Library for hashing passwords
- **🛡️ Role-Based Access Control** - Three-tier permission system (Admin, Editor, Reader)
- **🔑 Session Management** - Secure user session handling with localStorage

### 🧩 UI Components & Styling
- **🧩 shadcn/ui** - High-quality, accessible components built on Radix UI
- **🎯 Lucide React** - Beautiful & consistent icon library
- **🌈 Framer Motion** - Production-ready motion library for React
- **🎨 Next Themes** - Perfect dark mode in 2 lines of code

### 📋 Forms & Validation
- **🎣 React Hook Form** - Performant forms with easy validation
- **✅ Zod** - TypeScript-first schema validation

### 🔄 State Management & Data Fetching
- **🐻 Zustand** - Simple, scalable state management
- **🔄 TanStack Query** - Powerful data synchronization for React
- **🌐 Axios** - Promise-based HTTP client

### 🗄️ Database & Backend
- **🗄️ Prisma** - Next-generation Node.js and TypeScript ORM
- **🗄️ SQLite** - Lightweight, serverless database

### 🎨 Advanced UI Features
- **📊 TanStack Table** - Headless UI for building tables and datagrids
- **🖱️ DND Kit** - Modern drag and drop toolkit for React
- **📊 Recharts** - Redefined chart library built with React and D3
- **🖼️ Sharp** - High performance image processing

### 🌍 Internationalization & Utilities
- **🌍 Next Intl** - Internationalization library for Next.js
- **📅 Date-fns** - Modern JavaScript date utility library
- **🪝 ReactUse** - Collection of essential React hooks for modern development

## 🎯 Why This Application?

- **🏎️ Fast Development** - Pre-configured tooling and best practices
- **🎨 Beautiful UI** - Complete shadcn/ui component library with advanced interactions
- **🔒 Type Safety** - Full TypeScript configuration with Zod validation
- **📱 Responsive** - Mobile-first design principles with smooth animations
- **🗄️ Database Ready** - Prisma ORM configured for rapid backend development
- **🔐 Complete Authentication** - Custom authentication system with role-based access control
- **👥 User Management** - Admin panel for managing users with different permission levels
- **🔒 Security** - Password hashing, session management, and protected routes
- **📊 Data Visualization** - Charts, tables, and drag-and-drop functionality
- **🌍 i18n Ready** - Multi-language support with Next Intl
- **🚀 Production Ready** - Optimized build and deployment settings
- **🤖 AI-Friendly** - Structured codebase perfect for AI assistance

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to see your application running.

## 🔐 Authentication System

This application includes a comprehensive authentication system with the following features:

### User Roles
- **ADMIN** - Full access to all features including user management
- **EDITOR** - Can manage residents, payments, and view reports
- **READER** - Can view data but has limited editing capabilities

### Authentication Features
- **Secure Login** - Email and password authentication with bcryptjs hashing
- **User Registration** - New users can register with role assignment (admin only)
- **Password Management** - Users can securely change their passwords
- **Session Management** - Persistent sessions with automatic logout
- **Protected Routes** - All pages require authentication except login/register
- **Role-Based Navigation** - Menu items adapt based on user permissions

### Default Admin Account
- **Email**: admin@example.com
- **Password**: admin123
- **Role**: ADMIN

The admin account can be initialized by clicking the "Initialize Admin User" button on the login page.

### API Endpoints
- `/api/auth/login` - User authentication
- `/api/auth/register` - User registration
- `/api/auth/change-password` - Password update
- `/api/auth/users` - User management (CRUD operations)
- `/api/auth/init-admin` - Initialize default admin user

## 📁 Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── api/auth/                # Authentication API routes
│   │   ├── login/               # User login endpoint
│   │   ├── register/            # User registration endpoint
│   │   ├── change-password/     # Password update endpoint
│   │   ├── users/               # User management endpoint
│   │   └── init-admin/          # Admin initialization endpoint
│   ├── login/                   # Login page
│   ├── profile/                 # User profile page
│   └── users/                   # User management page
├── components/                   # Reusable React components
│   ├── auth/                    # Authentication components
│   │   ├── login-form.tsx       # Login form component
│   │   ├── register-form.tsx    # Registration form component
│   │   ├── change-password-form.tsx  # Password change form
│   │   └── user-management.tsx  # User management component
│   ├── layout/                  # Layout components
│   │   └── navigation.tsx       # Navigation component with auth
│   └── ui/                      # shadcn/ui components
├── hooks/                       # Custom React hooks
└── lib/                         # Utility functions and configurations
    ├── auth.ts                  # Authentication utilities
    └── db.ts                    # Database connection
```

## 🎨 Available Features & Components

This application includes a comprehensive set of features for IPL management:

### 🏠 IPL Management Core Features
- **Resident Management**: Complete CRUD operations for resident data with RT/RW organization
- **Payment Processing**: Multi-status payment system (VERIFIED, MANUAL_PAID, PENDING, REJECTED)
- **Schedule Management**: Flexible scheduling for IPL (monthly), THR (yearly), and Sumbangan (donations)
- **RT/RW Organization**: Hierarchical management with RT and RW structure
- **Payment Proof Upload**: File upload with AI-powered analysis capabilities
- **Real-time Monitoring**: Yearly grid dashboard showing payment status across all months

### 📊 Advanced Dashboard Features
- **Monitoring Dashboard**: Yearly payment grid (Jan-Dec + THR) with RT/Year filtering
- **Payment Status Tracking**: Color-coded status indicators (Paid, Overdue, Scheduled, Skipped, Pending)
- **Tunggakan Statistics**: Overdue payment tracking per RT and RW
- **Current Period Detection**: Automatic current month period recognition
- **Collection Rate Analytics**: Payment collection statistics and progress tracking

### 🎛️ Schedule Management System
- **Dynamic Schedule Generation**: 
  - IPL: Monthly recurring payments
  - THR: Yearly special payments with custom due dates
  - Sumbangan: Donation campaigns with expiration dates
- **Flexible Payment Status**:
  - IPL & THR: Always mandatory (WAJIB)
  - Sumbangan: Configurable as mandatory or voluntary (SUKARELA)
- **Manual Actions**:
  - Manual Mark Paid: For cash/direct payments
  - Skip Items: For non-applicable schedules with reason tracking
  - Delete Items: For incorrect schedule corrections
- **Smart Expiration**: Automatic disabling of expired donation items
- **Advanced Search & Filtering**:
  - Real-time search with 300ms debouncing
  - Multi-field search (Name, RT/RW, Blok, Label, Period)
  - Smart RT/RW search patterns ("RT1", "RT01", "RW2")
  - Year selector in header (default: current year)
  - Multi-criteria filtering (RT, Month, Status, Type)
  - Smart filter combination and active filter display
  - Keyboard shortcuts (Ctrl+K for search focus)
  - Empty state handling with contextual messages
  - Interactive search tips and examples
- **Amount Editing System**:
  - Single item amount editing with inline controls
  - Multi-select bulk amount editing for dispensations
  - Reason tracking for all amount changes
  - Audit trail with old/new amount comparison
  - Smart validation preventing negative amounts

- **Smart Total Calculation System**:
  - Accurate total calculations excluding SKIPPED items
  - Separate tracking of target vs actual totals
  - Real-time payment rate calculation
  - Consistent total logic across all dashboards
  - Detailed payment statistics display (target, paid, rate)
  - Proper handling of unscheduled vs skipped items

- **Advanced Payment Rules & Automation**:
  - Payment page excludes SKIPPED items and includes THR/Special items
  - Voluntary donation system with flexible amounts (zero for sukarela)
  - Auto-skip functionality for expired donations
  - Manual trigger for expired donation cleanup
  - Smart donation expiration handling
  - Proper status differentiation (PAID, SKIPPED, OPTIONAL, PLANNED)

- **Payment Verification System**:
  - Manual verification dashboard for admin approval/rejection
  - Multiple verification methods (manual check, bank statement, transfer proof)
  - Pending payments queue with summary statistics and advanced filtering
  - Payment proof viewer and analysis integration
  - Verification audit trail and notes system
  - Smart amount validation with edited amounts detection
  - Days waiting indicator for priority handling
  - Comprehensive payment details popup with responsive layout (max-width 6xl, 95% viewport)
  - Advanced search and filter capabilities (RT, month, status, resident info)
  - Resident address display with Blok/House number format
  - Schedule items comparison (original vs edited amounts) in card-based layout
  - Amount mismatch detection with context-aware validation
  - Collapsible payment proof viewer with image preview
  - Full-size image display with download functionality
  - AI analysis results integration for payment proofs
  - Responsive grid layout preventing horizontal scroll
  - Proper image path resolution and error handling
  - Graceful fallback for missing or corrupted images
  - Fully functional approve/reject verification with audit trail
  - PaymentVerification table with complete verification history
  - Simplified payment management (delete and re-create instead of edit)
  - Manual refresh button for dashboard updates
  - Resource-efficient dashboard without auto-refresh
  - Fixed dashboard total income calculation to include verified payments
  - Automatic schedule item release when payments are rejected

### 🎨 Enhanced User Experience
- **Visual Status Indicators**: 
  - 🟢 Green: Paid items with payment dates
  - 🔴 Red: Overdue items with days overdue
  - 🟡 Yellow: Scheduled items
  - 🟠 Orange: Skipped items
  - 🔵 Blue: Pending verification
  - ⚫ Gray: Unscheduled items
- **Smart Table Design**:
  - Color-coded type badges (IPL, THR, Sumbangan)
  - Contextual period display (Month/Year format)
  - RT/RW information in dedicated column
  - Improved information hierarchy and scanning
- **Interactive Monitoring Grid**: Clickable cells with detailed tooltips
- **Responsive Design**: Mobile-friendly interface with sticky columns
- **Real-time Updates**: Automatic refresh after actions

### 🔐 Authentication System
- **User Login**: Secure email and password authentication
- **User Registration**: New user creation with role assignment
- **Password Management**: Secure password change functionality
- **Role-Based Access**: Three-tier permission system (Admin, Editor, Reader)
- **Session Management**: Persistent user sessions with automatic logout
- **User Management**: Admin panel for managing users and permissions
- **Protected Routes**: All pages require authentication
- **Default Admin**: Pre-configured admin account (admin@example.com / admin123)

### 🧩 UI Components (shadcn/ui)
- **Layout**: Card, Separator, Aspect Ratio, Resizable Panels
- **Forms**: Input, Textarea, Select, Checkbox, Radio Group, Switch
- **Feedback**: Alert, Toast (Sonner), Progress, Skeleton
- **Navigation**: Breadcrumb, Menubar, Navigation Menu, Pagination
- **Overlay**: Dialog, Sheet, Popover, Tooltip, Hover Card
- **Data Display**: Badge, Avatar, Calendar

### 📊 Advanced Data Features
- **Tables**: Powerful data tables with sorting, filtering, pagination (TanStack Table)
- **Charts**: Beautiful visualizations with Recharts
- **Forms**: Type-safe forms with React Hook Form + Zod validation

### 🎨 Interactive Features
- **Animations**: Smooth micro-interactions with Framer Motion
- **Drag & Drop**: Modern drag-and-drop functionality with DND Kit
- **Theme Switching**: Built-in dark/light mode support

### 🔐 Backend Integration
- **Authentication**: Custom authentication system with bcryptjs
- **Database**: Type-safe database operations with Prisma and SQLite
- **API Client**: HTTP requests with Axios + TanStack Query
- **State Management**: Simple and scalable with Zustand

### 🌍 Production Features
- **Internationalization**: Multi-language support with Next Intl
- **Image Optimization**: Automatic image processing with Sharp
- **Type Safety**: End-to-end TypeScript with Zod validation
- **Essential Hooks**: 100+ useful React hooks with ReactUse for common patterns

NOTE: Program ini dikembangkan di vs code di windows dengan menggunakan powershell sebagai terminal.

## ⚙️ Sistem Pengaturan

### 💾 Penyimpanan Pengaturan
Pengaturan dalam aplikasi ini disimpan dengan dua cara:

1. **Database (Settings Table)**:
   - Pengaturan yang disimpan di database akan mempertahankan nilainya meskipun aplikasi di-restart
   - Pengaturan ini dapat diubah melalui halaman Settings di aplikasi
   - Termasuk:
     - `defaultAmount`: Nominal IPL default (Rp 250.000)
     - `dueDate`: Tanggal jatuh tempo pembayaran (tanggal 5)
     - `rwSettings.activeRWs`: Daftar RW yang aktif (misalnya [12])
     - `rwSettings.defaultRW`: RW default yang digunakan (misalnya 12)
     - `bankAccount`: Informasi rekening bank (BCA, 6050613567, YUPITHER BOUK)

2. **Hardcoded (Default Values)**:
   - Nilai default yang digunakan jika tidak ada pengaturan di database
   - Nilai ini digunakan sebagai fallback saat aplikasi pertama kali dijalankan
   - Nilai hardcoded sama dengan nilai default di database

### 🔄 Alur Pengaturan
1. Saat aplikasi dimulai, sistem mencoba mengambil pengaturan dari database
2. Jika pengaturan ditemukan di database, nilai tersebut digunakan
3. Jika pengaturan tidak ditemukan di database, nilai hardcoded digunakan sebagai fallback
4. Pengguna dapat mengubah pengaturan melalui halaman Settings
5. Perubahan pengaturan akan disimpan ke database
6. Perubahan akan berlaku setelah halaman di-refresh

### 📝 Contoh Penggunaan
```typescript
// Mengambil pengaturan dari API
const response = await fetch('/api/settings');
const data = await response.json();
const paymentSettings = data.paymentSettings;

// Menggunakan pengaturan
const defaultAmount = paymentSettings.defaultAmount; // 250000
const dueDate = paymentSettings.dueDate; // 5
const activeRWs = paymentSettings.rwSettings.activeRWs; // [12]
const defaultRW = paymentSettings.rwSettings.defaultRW; // 12
```

## 💡 Konsep Aplikasi

### 📋 Payment Schedule sebagai Invoice
Dalam konsep aplikasi ini, **Payment Schedule (Jadwal Pembayaran)** dianggap sebagai **invoice** yang diterbitkan di awal periode. Ini berarti:

- **Nominal Tetap**: Jumlah yang tercantum dalam payment schedule adalah nominal resmi yang harus dibayar untuk periode tersebut.
- **Ditetapkan di Awal**: Nominal ini ditetapkan saat pembuatan jadwal dan tidak berubah selama periode berjalan.
- **Sebagai Acuan**: Semua perhitungan pembayaran dan verifikasi mengacu pada nominal ini sebagai acuan utama.
- **Mengatur dari Settings**: Nominal default diambil dari pengaturan sistem (saat ini Rp 250.000 per bulan).

### 💳 Payment Index sebagai Biaya Admin
**Payment Index** dalam aplikasi ini berfungsi sebagai **biaya admin** atau **biaya transaksi**, bukan sebagai bagian dari pembayaran IPL:

- **Bukan Bagian IPL**: Payment index bukan merupakan bagian dari pembayaran IPL utama.
- **Biaya Transaksi**: Ini adalah biaya tambahan yang mungkin timbul saat proses pembayaran.
- **Identifikasi Unik**: Payment index dihasilkan dari kombinasi BLOK dan nomor rumah (C11/9 menjadi 119) untuk membantu identifikasi transaksi.
- **Dipisahkan dalam Verifikasi**: Saat verifikasi pembayaran, sistem memisahkan antara jumlah pembayaran IPL (sesuai schedule) dan payment index (biaya admin).

### 🔍 Logika Verifikasi Pembayaran
Berdasarkan konsep di atas, logika verifikasi pembayaran bekerja sebagai berikut:

1. **Schedule Amount sebagai Patokan**: Nominal yang tercantum dalam payment schedule dianggap sebagai patokan yang benar.
2. **Payment + Index = Total**: Jika pembayaran mencakup biaya admin, maka total pembayaran = schedule amount + payment index.
3. **Edit Amount untuk Dispensasi**: Jika ada perubahan jumlah pada schedule item, ini dianggap sebagai dispensasi khusus dan dicatat sebagai "edited amount".
4. **Verifikasi Berdasarkan Schedule**: Saat verifikasi, sistem memeriksa apakah pembayaran sesuai dengan:
   - Schedule amount (jika tidak ada biaya admin)
   - Schedule amount + payment index (jika ada biaya admin)

### 📊 Contoh Implementasi

**Contoh 1: Pembayaran Normal Tanpa Biaya Admin**
- Schedule amount: Rp 250.000
- Payment index: 0 (tidak ada biaya admin)
- Total pembayaran: Rp 250.000
- Status: ✅ Valid (sesuai schedule amount)

**Contoh 2: Pembayaran Dengan Biaya Admin**
- Schedule amount: Rp 250.000
- Payment index: 87 (biaya admin)
- Total pembayaran: Rp 250.087
- Status: ✅ Valid (sesuai schedule amount + payment index)

**Contoh 3: Pembayaran Dengan Dispensasi**
- Original schedule amount: Rp 250.000
- Edited schedule amount: Rp 200.000 (dispensasi)
- Payment index: 0
- Total pembayaran: Rp 200.000
- Status: ✅ Valid (sesuai edited amount, catatan: dispensasi)

### 🔄 Alur Data dalam Sistem

1. **Settings**: Admin menetapkan nominal default (Rp 250.000)
2. **Schedule Generation**: Sistem membuat jadwal pembayaran berdasarkan nominal dari settings
3. **Payment Submission**: Warga membayar sesuai jadwal (mungkin + biaya admin)
4. **Verification**: Sistem memverifikasi:
   - Apakah pembayaran sesuai schedule amount?
   - Atau sesuai schedule amount + payment index?
5. **Approval**: Pembayaran disetujui jika sesuai dengan kriteria di atas

Dengan konsep ini, aplikasi memastikan bahwa:
- **Transparansi**: Nominal pembayaran jelas dan mengacu pada schedule yang telah ditetapkan.
- **Akuntabilitas**: Setiap perubahan nominal (dispensasi) dicatat dan dapat dilacak.
- **Fleksibilitas**: Sistem dapat mengakomodasi biaya admin tanpa mengubah nominal IPL resmi.
- **Konsistensi**: Verifikasi selalu mengacu pada schedule sebagai "invoice" resmi.
