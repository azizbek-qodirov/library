import { useI18n } from '../../../shared/i18n';
import { Icon } from '../../../shared/Icon';

// Delete Confirmation Modal
const DeleteConfirmationModal = ({ isOpen, onConfirm, onCancel, itemName, isLoading }: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  itemName: string;
  isLoading: boolean;
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title text-danger">{t("Confirm Delete")}</h5>
            <button type="button" className="btn-close" aria-label={t("Close")} onClick={onCancel} disabled={isLoading}></button>
          </div>
          <div className="modal-body">
            <div className="text-center mb-3">
              <div className="text-danger mb-3" style={{ fontSize: '3rem' }}><Icon name="warning" size={28} /></div>
              <p className="mb-2">{t("Are you sure you want to delete “{name}”?", { name: itemName ?? "" })}</p>
              <p className="text-muted small">{t("This action cannot be undone.")}</p>
            </div>
          </div>
          <div className="modal-footer border-0 pt-0">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={isLoading}>
              {t("Cancel")}
            </button>
            <button 
              type="button" 
              className="btn btn-danger" 
              onClick={onConfirm} 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  {t("Deleting...")}
                </>
              ) : (
                t("Delete")
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;