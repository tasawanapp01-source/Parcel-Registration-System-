import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  UserCheck,
  GraduationCap,
  UserPlus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Sliders,
  Check,
  X,
  Layers,
  FileEdit,
  ShieldAlert,
} from 'lucide-react';
import { useParcelSystem, UpsertMemberInput } from '../context/ParcelSystemContext';
import {
  Member,
  MemberRole,
  AppMenuKey,
  APP_MENU_DEFINITIONS,
  ALL_MENU_KEYS,
  DEFAULT_STAFF_MENU_KEYS,
  DEFAULT_TEACHER_MENU_KEYS,
} from '../types/parcel';

export const MembersAccessView: React.FC = () => {
  const {
    members,
    rolePermissions,
    currentMember,
    upsertMember,
    deleteMember,
    updateRolePermission,
    getEffectiveMemberMenus,
  } = useParcelSystem();

  const [activeSection, setActiveSection] = useState<'members' | 'permissions'>('members');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  // Form states
  const [formData, setFormData] = useState<UpsertMemberInput>({
    username: '',
    password: '',
    fullName: '',
    role: 'เจ้าหน้าที่',
    allowedMenus: [...DEFAULT_STAFF_MENU_KEYS],
    useCustomMenus: false,
    canEdit: true,
    canDelete: false,
    active: true,
  });
  const [formError, setFormError] = useState('');

  // Role permissions draft states
  const adminRole = rolePermissions.find((r) => r.roleId === 'admin');
  const staffRole = rolePermissions.find((r) => r.roleId === 'staff' || r.roleId === ('user' as any));
  const teacherRole = rolePermissions.find((r) => r.roleId === 'teacher');

  const [adminMenus, setAdminMenus] = useState<AppMenuKey[]>(
    adminRole?.allowedMenus || [...ALL_MENU_KEYS]
  );
  const [staffMenus, setStaffMenus] = useState<AppMenuKey[]>(
    staffRole?.allowedMenus || [...DEFAULT_STAFF_MENU_KEYS]
  );
  const [staffCanEdit, setStaffCanEdit] = useState<boolean>(
    staffRole?.canEdit !== undefined ? staffRole.canEdit : true
  );
  const [staffCanDelete, setStaffCanDelete] = useState<boolean>(
    staffRole?.canDelete !== undefined ? staffRole.canDelete : false
  );

  const [teacherMenus, setTeacherMenus] = useState<AppMenuKey[]>(
    teacherRole?.allowedMenus || [...DEFAULT_TEACHER_MENU_KEYS]
  );
  const [teacherCanEdit, setTeacherCanEdit] = useState<boolean>(
    teacherRole?.canEdit !== undefined ? teacherRole.canEdit : false
  );
  const [teacherCanDelete, setTeacherCanDelete] = useState<boolean>(
    teacherRole?.canDelete !== undefined ? teacherRole.canDelete : false
  );

  const handleOpenAddModal = () => {
    setEditingMember(null);
    setFormData({
      username: '',
      password: '1234',
      fullName: '',
      role: 'เจ้าหน้าที่',
      allowedMenus: [...DEFAULT_STAFF_MENU_KEYS],
      useCustomMenus: false,
      canEdit: true,
      canDelete: false,
      active: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member: Member) => {
    setEditingMember(member);
    const effectiveRole: MemberRole =
      member.role === 'ผู้ดูแลระบบ'
        ? 'ผู้ดูแลระบบ'
        : member.role === 'ครู'
        ? 'ครู'
        : 'เจ้าหน้าที่';

    setFormData({
      memberId: member.memberId,
      username: member.username,
      password: member.password,
      fullName: member.fullName,
      role: effectiveRole,
      allowedMenus: [...member.allowedMenus],
      useCustomMenus: member.useCustomMenus,
      canEdit: member.canEdit !== undefined ? member.canEdit : effectiveRole !== 'ครู',
      canDelete: member.canDelete !== undefined ? member.canDelete : effectiveRole === 'ผู้ดูแลระบบ',
      active: member.active,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleRoleChangeInForm = (newRole: MemberRole) => {
    if (newRole === 'ครู') {
      setFormData((prev) => ({
        ...prev,
        role: newRole,
        allowedMenus: prev.useCustomMenus ? prev.allowedMenus : [...DEFAULT_TEACHER_MENU_KEYS],
        canEdit: false,
        canDelete: false,
      }));
    } else if (newRole === 'เจ้าหน้าที่') {
      setFormData((prev) => ({
        ...prev,
        role: newRole,
        allowedMenus: prev.useCustomMenus ? prev.allowedMenus : [...DEFAULT_STAFF_MENU_KEYS],
        canEdit: true,
        canDelete: false,
      }));
    } else if (newRole === 'ผู้ดูแลระบบ') {
      setFormData((prev) => ({
        ...prev,
        role: newRole,
        allowedMenus: [...ALL_MENU_KEYS],
        canEdit: true,
        canDelete: true,
      }));
    }
  };

  const handleToggleMenuInForm = (menuKey: AppMenuKey) => {
    setFormData((prev) => {
      const exists = prev.allowedMenus.includes(menuKey);
      const updated = exists
        ? prev.allowedMenus.filter((k) => k !== menuKey)
        : [...prev.allowedMenus, menuKey];
      return { ...prev, allowedMenus: updated };
    });
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim()) {
      setFormError('กรุณากรอกชื่อผู้ใช้ (Username)');
      return;
    }
    if (!formData.password.trim()) {
      setFormError('กรุณากรอกรหัสผ่าน');
      return;
    }
    if (!formData.fullName.trim()) {
      setFormError('กรุณากรอกชื่อ-นามสกุล / ตำแหน่ง');
      return;
    }

    const duplicate = members.find(
      (m) =>
        m.username.trim().toLowerCase() === formData.username.trim().toLowerCase() &&
        m.memberId !== editingMember?.memberId
    );
    if (duplicate) {
      setFormError('ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว กรุณาเลือกชื่ออื่น');
      return;
    }

    await upsertMember(formData);
    setIsModalOpen(false);
  };

  const handleDelete = async (member: Member) => {
    if (member.memberId === currentMember?.memberId) {
      if (!window.confirm('คุณกำลังจะลบบัญชีของตัวเอง คุณแน่ใจหรือไม่?')) {
        return;
      }
    } else {
      if (!window.confirm(`ยืนยันการลบสมาชิก "${member.fullName}" (@${member.username}) หรือไม่?`)) {
        return;
      }
    }
    await deleteMember(member.memberId);
  };

  const handleSaveRolePermissions = async () => {
    await updateRolePermission('admin', adminMenus, true, true);
    await updateRolePermission('staff', staffMenus, staffCanEdit, staffCanDelete);
    await updateRolePermission('teacher', teacherMenus, teacherCanEdit, teacherCanDelete);
  };

  const toggleAdminRoleMenu = (key: AppMenuKey) => {
    setAdminMenus((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleStaffRoleMenu = (key: AppMenuKey) => {
    setStaffMenus((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleTeacherRoleMenu = (key: AppMenuKey) => {
    setTeacherMenus((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const adminCount = members.filter((m) => m.role === 'ผู้ดูแลระบบ').length;
  const staffCount = members.filter((m) => m.role === 'เจ้าหน้าที่' || (m.role as string) === 'ผู้ใช้').length;
  const teacherCount = members.filter((m) => m.role === 'ครู').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              จัดการสมาชิก & สิทธิ์การเข้าถึงเมนู
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            ระบบกำหนดสิทธิ์ 3 ระดับ: ผู้ดูแลระบบ, เจ้าหน้าที่, ครู พร้อมจัดการสิทธิ์เมนูและการแก้ไข/ลบข้อมูลรายบุคคล
          </p>
        </div>

        {/* Section switcher pills */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSection('members')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSection === 'members'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            รายชื่อสมาชิก ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('permissions')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeSection === 'permissions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            หน้าอนุญาตการเข้าถึงเมนู
          </button>
        </div>
      </div>

      {/* SECTION 1: Members List */}
      {activeSection === 'members' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                <ShieldCheck className="w-3.5 h-3.5" />
                ผู้ดูแลระบบ: {adminCount}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                <UserCheck className="w-3.5 h-3.5" />
                เจ้าหน้าที่: {staffCount}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 font-semibold border border-amber-100">
                <GraduationCap className="w-3.5 h-3.5" />
                ครู: {teacherCount}
              </span>
            </div>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>เพิ่มสมาชิกใหม่</span>
            </button>
          </div>

          {/* Members Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-semibold">
                    <th className="py-3.5 px-4">ชื่อผู้ใช้ / ผู้ใช้งาน</th>
                    <th className="py-3.5 px-4">ระดับสิทธิ์</th>
                    <th className="py-3.5 px-4">สิทธิ์แก้ไข / ลบ</th>
                    <th className="py-3.5 px-4">การกำหนดเมนู</th>
                    <th className="py-3.5 px-4">เมนูที่เข้าถึงได้</th>
                    <th className="py-3.5 px-4 text-center">สถานะ</th>
                    <th className="py-3.5 px-4 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((member) => {
                    const effectiveMenus = getEffectiveMemberMenus(member);
                    const isSelf = member.memberId === currentMember?.memberId;
                    const displayRole: MemberRole =
                      member.role === 'ผู้ดูแลระบบ'
                        ? 'ผู้ดูแลระบบ'
                        : member.role === 'ครู'
                        ? 'ครู'
                        : 'เจ้าหน้าที่';

                    const canEdit = member.canEdit !== undefined ? member.canEdit : displayRole !== 'ครู';
                    const canDelete = member.canDelete !== undefined ? member.canDelete : displayRole === 'ผู้ดูแลระบบ';

                    return (
                      <tr key={member.memberId} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                displayRole === 'ผู้ดูแลระบบ'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : displayRole === 'ครู'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {displayRole === 'ผู้ดูแลระบบ' ? (
                                <ShieldCheck className="w-4 h-4" />
                              ) : displayRole === 'ครู' ? (
                                <GraduationCap className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">
                                  {member.fullName}
                                </span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                    คุณ
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-xs text-slate-500">
                                @{member.username}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              displayRole === 'ผู้ดูแลระบบ'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : displayRole === 'ครู'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {displayRole}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1 text-[11px]">
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                canEdit ? 'text-emerald-700' : 'text-slate-400'
                              }`}
                            >
                              {canEdit ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>แก้ไขได้</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3 text-slate-400" />
                                  <span>ไม่อนุญาตให้แก้ไข</span>
                                </>
                              )}
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                canDelete ? 'text-rose-700' : 'text-slate-400'
                              }`}
                            >
                              {canDelete ? (
                                <>
                                  <Check className="w-3 h-3 text-rose-600" />
                                  <span>ลบได้</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3 text-slate-400" />
                                  <span>ไม่อนุญาตให้ลบ</span>
                                </>
                              )}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {member.useCustomMenus ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                              <Sliders className="w-3.5 h-3.5" />
                              สิทธิ์เฉพาะบุคคล
                            </span>
                          ) : (
                            <span className="text-slate-500">ตามระดับ ({displayRole})</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {effectiveMenus.map((menuKey) => {
                              const def = APP_MENU_DEFINITIONS.find((d) => d.key === menuKey);
                              return (
                                <span
                                  key={menuKey}
                                  className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium"
                                >
                                  {def?.shortLabel || menuKey}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {member.active ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <CheckCircle2 className="w-4 h-4" />
                              ใช้งาน
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500">
                              <XCircle className="w-4 h-4" />
                              ระงับ
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(member)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              title="แก้ไขข้อมูลสมาชิก"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(member)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="ลบสมาชิก"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Menu & Action Permissions Configuration */}
      {activeSection === 'permissions' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  กำหนดสิทธิ์เมนูและสิทธิ์การทำงานเริ่มต้นตามระดับ (Default Role Access)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  กำหนดเมนูเริ่มต้นและสิทธิ์การแก้ไข/ลบข้อมูลสำหรับแต่ละระดับ (ผู้ดูแลระบบ, เจ้าหน้าที่, ครู)
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveRolePermissions}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <Check className="w-4 h-4" />
                <span>บันทึกสิทธิ์ระดับสมาชิก</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1. Admin Role Permission Card */}
              <div className="p-5 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
                        <ShieldCheck className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          ระดับ: ผู้ดูแลระบบ (Admin)
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          สิทธิ์สูงสุด ควบคุมทั้งระบบ
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">
                      {adminMenus.length} เมนู
                    </span>
                  </div>

                  <div className="py-2.5 px-3 bg-white rounded-lg border border-indigo-100 text-xs text-indigo-900 space-y-1 my-3">
                    <div className="flex items-center gap-2 font-medium">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>อนุญาตให้แก้ไขข้อมูลทั้งหมด</span>
                    </div>
                    <div className="flex items-center gap-2 font-medium">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>อนุญาตให้ลบข้อมูลทั้งหมด</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {APP_MENU_DEFINITIONS.map((menu) => {
                      const isChecked = adminMenus.includes(menu.key);
                      const isMembersMandatory = menu.key === 'members';

                      return (
                        <label
                          key={`admin-${menu.key}`}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-white border-indigo-200 text-slate-900 shadow-2xs'
                              : 'bg-white/40 border-slate-200/80 text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isMembersMandatory}
                            checked={isChecked}
                            onChange={() => toggleAdminRoleMenu(menu.key)}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div className="flex-1 text-xs">
                            <div className="flex items-center gap-1.5 font-semibold">
                              <span>{menu.label}</span>
                              {isMembersMandatory && (
                                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1 rounded">
                                  เมนูหลัก
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Staff Role Permission Card */}
              <div className="p-5 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
                        <UserCheck className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          ระดับ: เจ้าหน้าที่ (Staff)
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          เจ้าหน้าที่ห้องพัสดุปฏิบัติการ
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                      {staffMenus.length} เมนู
                    </span>
                  </div>

                  <div className="py-2.5 px-3 bg-white rounded-lg border border-emerald-100 text-xs text-slate-800 space-y-2 my-3">
                    <label className="flex items-center gap-2 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffCanEdit}
                        onChange={(e) => setStaffCanEdit(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>อนุญาตให้แก้ไขข้อมูล</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffCanDelete}
                        onChange={(e) => setStaffCanDelete(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span>อนุญาตให้ลบข้อมูล</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    {APP_MENU_DEFINITIONS.map((menu) => {
                      const isChecked = staffMenus.includes(menu.key);

                      return (
                        <label
                          key={`staff-${menu.key}`}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-white border-emerald-200 text-slate-900 shadow-2xs'
                              : 'bg-white/40 border-slate-200/80 text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleStaffRoleMenu(menu.key)}
                            className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="flex-1 text-xs">
                            <span className="font-semibold block">{menu.label}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Teacher Role Permission Card */}
              <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/30 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-amber-100">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-amber-600 text-white">
                        <GraduationCap className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          ระดับ: ครู (Teacher)
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          รับพัสดุ & ค้นหา (ห้ามแก้ไข/ลบ)
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                      {teacherMenus.length} เมนู
                    </span>
                  </div>

                  <div className="py-2.5 px-3 bg-white rounded-lg border border-amber-100 text-xs text-slate-800 space-y-2 my-3">
                    <label className="flex items-center gap-2 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={teacherCanEdit}
                        onChange={(e) => setTeacherCanEdit(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>อนุญาตให้แก้ไขข้อมูล</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={teacherCanDelete}
                        onChange={(e) => setTeacherCanDelete(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span>อนุญาตให้ลบข้อมูล</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    {APP_MENU_DEFINITIONS.map((menu) => {
                      const isChecked = teacherMenus.includes(menu.key);

                      return (
                        <label
                          key={`teacher-${menu.key}`}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-white border-amber-200 text-slate-900 shadow-2xs'
                              : 'bg-white/40 border-slate-200/80 text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleTeacherRoleMenu(menu.key)}
                            className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <div className="flex-1 text-xs">
                            <span className="font-semibold block">{menu.label}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Matrix of all members and their menu & action access */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              ตารางสรุปสิทธิ์การเข้าถึงเมนูและการแก้ไข/ลบของสมาชิกทุกคน
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              ตรวจสอบว่าสมาชิกแต่ละคนได้รับสิทธิ์แก้ไข, สิทธิ์ลบข้อมูล และเมนูใดบ้าง
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-3 text-left">สมาชิก</th>
                    <th className="py-3 px-3 text-left">ระดับ</th>
                    <th className="py-3 px-3 text-center">สิทธิ์แก้ไข</th>
                    <th className="py-3 px-3 text-center">สิทธิ์ลบ</th>
                    {APP_MENU_DEFINITIONS.map((m) => (
                      <th key={m.key} className="py-3 px-2 text-center whitespace-nowrap">
                        {m.shortLabel}
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => {
                    const effective = getEffectiveMemberMenus(m);
                    const displayRole: MemberRole =
                      m.role === 'ผู้ดูแลระบบ'
                        ? 'ผู้ดูแลระบบ'
                        : m.role === 'ครู'
                        ? 'ครู'
                        : 'เจ้าหน้าที่';

                    const canEdit = m.canEdit !== undefined ? m.canEdit : displayRole !== 'ครู';
                    const canDelete = m.canDelete !== undefined ? m.canDelete : displayRole === 'ผู้ดูแลระบบ';

                    return (
                      <tr key={`matrix-${m.memberId}`} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {m.fullName}
                          <span className="block font-mono text-[10px] text-slate-400">
                            @{m.username}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              displayRole === 'ผู้ดูแลระบบ'
                                ? 'bg-indigo-50 text-indigo-700'
                                : displayRole === 'ครู'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {displayRole}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          {canEdit ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              แก้ไขได้
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                              ห้ามแก้ไข
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center">
                          {canDelete ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              ลบได้
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                              ห้ามลบ
                            </span>
                          )}
                        </td>

                        {APP_MENU_DEFINITIONS.map((menu) => {
                          const hasAccess = effective.includes(menu.key);
                          return (
                            <td key={`cell-${m.memberId}-${menu.key}`} className="py-3 px-2 text-center">
                              {hasAccess ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-300">
                                  <X className="w-3 h-3" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(m)}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                          >
                            ปรับสิทธิ์
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Member */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingMember ? 'แก้ไขข้อมูลสมาชิก' : 'เพิ่มสมาชิกใหม่'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    กำหนดชื่อผู้ใช้ รหัสผ่าน ระดับสิทธิ์ และสิทธิ์การเข้าถึงเมนู
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveMember} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อผู้ใช้งาน (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="เช่น teacher_somjai"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    รหัสผ่าน (Password) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="รหัสผ่านเข้าใช้งาน"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อ-นามสกุล / ตำแหน่ง *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="เช่น ครูสมศรี ประจำหอพัก A1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ระดับสมาชิก (Role) *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChangeInForm(e.target.value as MemberRole)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="เจ้าหน้าที่">เจ้าหน้าที่ (Staff)</option>
                    <option value="ครู">ครู (Teacher - รับเข้า & ค้นหา)</option>
                    <option value="ผู้ดูแลระบบ">ผู้ดูแลระบบ (Administrator)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    สถานะการใช้งาน
                  </label>
                  <div className="flex items-center gap-3 pt-1.5">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="active-status"
                        checked={formData.active}
                        onChange={() => setFormData({ ...formData, active: true })}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>เปิดใช้งาน</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="active-status"
                        checked={!formData.active}
                        onChange={() => setFormData({ ...formData, active: false })}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>ระงับการใช้งาน</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Permissions Checkboxes (กำหนดแต่ละ User ไม่ให้ทำการ ลบ หรือ แก้ไข ข้อมูล) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-semibold text-slate-800 block">
                  กำหนดสิทธิ์การแก้ไขและลบข้อมูลของ User นี้:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.canEdit)}
                      onChange={(e) => setFormData({ ...formData, canEdit: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex items-center gap-1 font-medium text-slate-800">
                      <FileEdit className="w-3.5 h-3.5 text-indigo-600" />
                      <span>อนุญาตให้แก้ไขข้อมูล</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.canDelete)}
                      onChange={(e) => setFormData({ ...formData, canDelete: e.target.checked })}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <div className="flex items-center gap-1 font-medium text-slate-800">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span>อนุญาตให้ลบข้อมูล</span>
                    </div>
                  </label>
                </div>
                {formData.role === 'ครู' && !formData.canEdit && !formData.canDelete && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    ℹ️ ระดับ <strong>ครู</strong> ถูกกำหนดให้ค้นหาและติดตามพัสดุได้ โดยไม่อนุญาตให้แก้ไขหรือลบข้อมูลตามระเบียบ
                  </p>
                )}
              </div>

              {/* Custom Menus Toggle */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.useCustomMenus}
                    onChange={(e) =>
                      setFormData({ ...formData, useCustomMenus: e.target.checked })
                    }
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>กำหนดสิทธิ์การเข้าถึงเมนูเฉพาะบุคคล (Custom Menu Permissions)</span>
                </label>
                <p className="text-[11px] text-slate-500 ml-5 mt-0.5">
                  หากไม่เลือก จะได้รับสิทธิ์ตามค่าเริ่มต้นของระดับสมาชิก (
                  {formData.role})
                </p>

                {formData.useCustomMenus && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 max-h-48 overflow-y-auto">
                    {APP_MENU_DEFINITIONS.map((menu) => {
                      const isChecked = formData.allowedMenus.includes(menu.key);
                      return (
                        <label
                          key={`form-menu-${menu.key}`}
                          className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer hover:bg-slate-100 p-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleMenuInForm(menu.key)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="font-medium">{menu.label}</span>
                          <span className="text-[10px] text-slate-400">({menu.shortLabel})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {editingMember ? 'บันทึกการแก้ไข' : 'เพิ่มสมาชิก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
