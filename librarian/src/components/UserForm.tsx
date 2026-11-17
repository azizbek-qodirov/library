import { useI18n } from '../../../shared/i18n';

import React, { useState } from 'react';
import type { User, UserFormData } from './types';

// User Form Component
const UserForm = ({ user, onSave, onCancel, isLoading }: {
  user?: User;
  onSave: (data: UserFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState<UserFormData>({
    full_name: user?.full_name || '',
    group_name: user?.group_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    role: user?.role || 'student'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">{user ? t("Edit User") : t("Add New User")}</h5>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label fw-semibold" htmlFor="borrower-full-name">{t("Full Name *")}</label>
              <input
                id="borrower-full-name"
                type="text"
                className="form-control"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label fw-semibold" htmlFor="borrower-group-name">{t("Group Name")}</label>
              <input
                id="borrower-group-name"
                type="text"
                className="form-control"
                value={formData.group_name}
                onChange={(e) => setFormData(prev => ({ ...prev, group_name: e.target.value }))}
              />
            </div>
          </div>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label fw-semibold" htmlFor="borrower-email">{t("Email")}</label>
              <input
                id="borrower-email"
                type="email"
                className="form-control"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label fw-semibold" htmlFor="borrower-phone">{t("Phone")}</label>
              <input
                id="borrower-phone"
                type="tel"
                className="form-control"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="form-label fw-semibold" htmlFor="borrower-role">{t("Role *")}</label>
            <select
              id="borrower-role"
              className="form-select"
              value={formData.role}
              onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'student' | 'teacher' }))}
              required
            >
              <option value="student">{t("Student")}</option>
              <option value="teacher">{t("Teacher")}</option>
            </select>
          </div>
          <div className="d-flex gap-2">
            <button
              type="submit"
              className="btn btn-primary px-4"
              disabled={isLoading || !formData.full_name.trim()}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  {t("Saving...")}
                </>
              ) : (
                user ? t("Update User") : t("Create User")
              )}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary px-4"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
            >
              {t("Cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;
