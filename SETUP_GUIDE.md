# คู่มือการติดตั้งและใช้งานระบบจัดการและคัดแยกพัสดุนักเรียน (Student Parcel Management & Tracking System)

## 1. โครงสร้างฐานข้อมูล Firebase (Firestore Data Model)

ระบบออกแบบโดยใช้หลักการ **Extended Reference Pattern (Denormalization)** และ **Local-First Cache + Write Queue** เพื่อลดจำนวนการอ่าน/เขียน (Read/Write Quota) ของ Firebase Firestore ให้เหลือน้อยที่สุด

### Collection 1: `students` (ทะเบียนนักเรียนประจำหอพัก)
- **Document ID**: `studentCode` (เช่น `"66101"`) เพื่อป้องกันข้อมูลซ้ำเมื่ออัปโหลด CSV ซ้ำ และสามารถอ้างอิง O(1) ได้ทันที
- **Fields**:
  - `studentCode` (string): รหัสนักเรียน เช่น `"66101"`
  - `seqNo` (number): เลขที่ตามทะเบียน เช่น `1`
  - `prefix` (string): คำนำหน้าชื่อ เช่น `"นาย"`, `"นางสาว"`
  - `firstName` (string): ชื่อจริง
  - `lastName` (string): นามสกุล
  - `nickname` (string): ชื่อเล่น
  - `grade` (string): ระดับชั้น เช่น `"ม.4"`
  - `room` (string): ห้องเรียน เช่น `"1"`
  - `dormitory` (string): ชื่อหอพัก เช่น `"หอพักราชพฤกษ์"`, `"หอพักอินทนิล"`, `"หอพักจามจุรี"`, `"หอพักชัยพฤกษ์"`
  - `dormRoom` (string): ห้องพักหอ เช่น `"204"`
  - `bed` (string): เตียง เช่น `"A2"`
  - `ownerId` (string): UID ของเจ้าหน้าที่ผู้บันทึกข้อมูล
  - `createdAt` (timestamp): เวลาที่สร้าง
  - `updatedAt` (timestamp): เวลาที่แก้ไขล่าสุด

### Collection 2: `parcels` (รายการพัสดุและการติดตามสถานะ)
- **Document ID**: รหัสอ้างอิงพัสดุ (เช่น `trackingNumber`)
- **Fields**:
  - `trackingNumber` (string): เลข Tracking จากบาร์โค้ด เช่น `"TH88492011A"`
  - `studentCode` (string): รหัสนักเรียนผู้รับ
  - `studentFullName` (string): คำนำหน้า + ชื่อ-นามสกุล (ทำ Denormalization เก็บไว้ในใบพัสดุเลย ไม่ต้อง Join ตาราง `students` ซ้ำ)
  - `nickname` (string): ชื่อเล่น
  - `gradeRoom` (string): ระดับชั้น/ห้อง เช่น `"ม.4/1"`
  - `dormitory` (string): ชื่อหอพัก
  - `dormRoom` (string): ห้องพักหอ
  - `bed` (string): เตียง
  - `category` (string): `"ของใช้ส่วนตัว"` | `"อาหารแห้ง"` | `"เครื่องเขียน/หนังสือ"` | `"เสื้อผ้า/เครื่องแต่งกาย"` | `"อุปกรณ์อิเล็กทรอนิกส์"` | `"เวชภัณฑ์/ยา"` | `"อื่นๆ"`
  - `status` (string): `"รับเข้าส่วนกลาง"` | `"ระหว่างส่งไปหอ"` | `"ติดนิติการ"` | `"รอการยืนยัน"` | `"ส่งมอบสำเร็จ"`
  - `courier` (string): บริษัทขนส่ง เช่น `"Flash Express"`, `"Kerry"`, `"ไปรษณีย์ไทย"`, `"J&T"`, `"Shopee Xpress"`
  - `note` (string): หมายเหตุ
  - `receivedDate` (string): วันที่รับเข้า `YYYY-MM-DD`
  - `receivedHour` (number): ชั่วโมงที่รับเข้า `0-23` สำหรับคำนวณ Peak Hours
  - `ownerId` (string): UID ของเจ้าหน้าที่
  - `createdAt` (timestamp): เวลาที่รับเข้า
  - `updatedAt` (timestamp): เวลาที่อัปเดตล่าสุด

---

## 2. กลยุทธ์ลด Limit การใช้งาน Firebase (Zero-Read Local Cache & Batch Write Queue)

1. **Local-First Student Directory Cache (`localStorage` / `spms_students_cache_v1`)**:
   - ข้อมูลนักเรียนจะไม่เปลี่ยนแปลงบ่อย เมื่อ Import CSV หรือดึงข้อมูลครั้งแรก ระบบจะบันทึกทั้งหมดไว้ในเครื่อง (`localStorage`)
   - ตอนพนักงานสแกนพัสดุและพิมพ์รหัสนักเรียน ระบบจะค้นหาจาก Local Memory Map (`Map<studentCode, Student>`) ใช้เวลา `< 1ms` และ **ใช้ Firestore Read = 0 ครั้ง**
2. **Local Buffer & Batch Sync Queue (`spms_pending_writes_v1`)**:
   - เมื่อเปิดโหมด **"บันทึกลงตัวโปรแกรมก่อน (Local Buffer Mode)"** ทุกครั้งที่สแกนรับพัสดุหรือเปลี่ยนสถานะ ข้อมูลจะถูกบันทึกลงหน่วยความจำในโปรแกรมทันที และเข้าคิว `pendingWrites`
   - เมื่อพนักงานสแกนเสร็จเป็นรอบๆ (เช่น 100 กล่อง) ค่อยกดปุ่ม **"ซิงก์ขึ้น Firebase (Batch Sync)"** ระบบจะรวบคำสั่งทั้งหมดส่งผ่าน `writeBatch(db)` ในครั้งเดียว
3. **In-Memory Inverted Search Index สำหรับค้นหาพัสดุ**:
   - การค้นหาพัสดุด้วยเลข Tracking, ชื่อนักเรียน หรือรหัสนักเรียน จะค้นหาผ่านดัชนีในเครื่อง (`localStorage` + React State) ก่อนเสมอ ทำให้การพิมพ์ค้นหาทุกตัวอักษร (Keystroke) **ไม่เสียโควตา Firestore Read เลย**

---

## 3. วิธีตั้งค่า Firebase และนำขึ้น GitHub Pages

1. สร้างโปรเจกต์ที่ [Firebase Console](https://console.firebase.google.com/)
2. เปิดใช้งาน **Firestore Database** และ **Authentication (Google Sign-In)**
3. นำค่า Config มาใส่ในไฟล์ `firebase-applet-config.json`
4. อัปโหลดโค้ดขึ้น GitHub Repository ที่กิ่ง `main`
5. ไปที่เมนู **Settings > Pages** บน GitHub แล้วเลือก **Build and deployment > Source: GitHub Actions**
6. ทุกครั้งที่ `git push origin main` ไฟล์ `.github/workflows/deploy.yml` จะทำการ Build และ Deploy ขึ้น GitHub Pages โดยอัตโนมัติ
