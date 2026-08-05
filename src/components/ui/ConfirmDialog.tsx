/**
 * 确认对话框组件
 * 用于危险操作前的二次确认，支持标题、内容、确认/取消按钮
 */
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;              // 是否打开
  title?: string;              // 标题
  content: string;            // 内容
  confirmText?: string;        // 确认按钮文字
  cancelText?: string;         // 取消按钮文字
  danger?: boolean;            // 是否危险操作（红色按钮）
  onConfirm: () => void;      // 确认回调
  onCancel: () => void;        // 取消回调
}

/**
 * 确认对话框
 * 基于 Modal + Button 组合实现
 */
export function ConfirmDialog({
  open,
  title = '确认操作',
  content,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="md"
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-secondary leading-relaxed">{content}</p>
    </Modal>
  );
}
