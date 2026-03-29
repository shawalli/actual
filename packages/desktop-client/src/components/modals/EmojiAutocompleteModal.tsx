import React from 'react';
import { useTranslation } from 'react-i18next';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { EmojiSelect } from '@desktop-client/components/select/EmojiSelect';
import {
  ModalCloseButton,
  Modal,
  ModalTitle,
  ModalHeader,
} from '@desktop-client/components/common/Modal';
import { SectionLabel } from '@desktop-client/components/forms';
import { type Modal as ModalType } from '@desktop-client/modals/modalsSlice';

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
      {({ state: { close } }) => (
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
                  onPress={close}
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
                isOpen={true}
                embedded={true}
                focused={true}
                openOnFocus={false}
                clearOnBlur={false}
                onSelect={emoji => {
                  onSelect(emoji);
                  close();
                }}
                inputProps={{
                  onBlur: () => {},
                  onKeyDown: () => {},
                  style: {},
                }}
              />
            </View>
          </View>
        </>
      )}
    </Modal>
  );
}

