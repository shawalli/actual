import { useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import {
  Modal,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import { SectionLabel } from '#components/forms';
import { EmojiSelect } from '#components/select/EmojiSelect';
import type { Modal as ModalType } from '#modals/modalsSlice';

type EmojiAutocompleteModalProps = Extract<
  ModalType,
  { name: 'emoji-autocomplete' }
>['options'];

export function EmojiAutocompleteModal({
  onSelect,
  onClose,
}: EmojiAutocompleteModalProps) {
  const { t } = useTranslation();
  const { isNarrowWidth } = useResponsive();

  return (
    <Modal
      name="emoji-autocomplete"
      noAnimation={!isNarrowWidth}
      onClose={onClose}
      containerProps={{
        style: {
          height: isNarrowWidth
            ? 'calc(var(--visual-viewport-height) * 0.85)'
            : 'auto',
          backgroundColor: theme.menuAutoCompleteBackground,
          minWidth: 225,
          maxWidth: 225,
        },
      }}
    >
      {({ state }) => {
        const closeModal = () => state.close();

        return (
          <>
            {isNarrowWidth && (
              <ModalHeader
                title={
                  <ModalTitle
                    title={t('Flag')}
                    getStyle={() => ({ color: theme.menuAutoCompleteText })}
                  />
                }
                rightContent={
                  <ModalCloseButton
                    onPress={closeModal}
                    style={{ color: theme.menuAutoCompleteText }}
                  />
                }
              />
            )}
            <View>
              {!isNarrowWidth && (
                <SectionLabel
                  title={t('Flag')}
                  style={{
                    alignSelf: 'center',
                    color: theme.menuAutoCompleteText,
                    marginBottom: 10,
                  }}
                />
              )}
              <View style={{ flex: 1, padding: 10 }}>
                <EmojiSelect
                  value={null}
                  isOpen
                  embedded
                  focused
                  openOnFocus={false}
                  clearOnBlur={false}
                  onSelect={emoji => {
                    onSelect(emoji);
                    closeModal();
                  }}
                  inputProps={{
                    style: {},
                  }}
                />
              </View>
            </View>
          </>
        );
      }}
    </Modal>
  );
}
