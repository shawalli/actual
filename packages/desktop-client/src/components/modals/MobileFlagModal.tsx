import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import {
  nativeToShortcode,
  shortcodeToNative,
} from '@actual-app/core/shared/emoji';

import {
  Modal,
  ModalCloseButton,
  ModalHeader,
  ModalTitle,
} from '#components/common/Modal';
import type { Modal as ModalType } from '#modals/modalsSlice';
import { MOBILE_RECENT_FLAGS_LIMIT } from '#transactions/recentFlags';

type MobileFlagModalProps = Extract<
  ModalType,
  { name: 'mobile-flag' }
>['options'];

const emojiLikeRegex =
  /[\p{Emoji}\p{Emoji_Presentation}\p{Extended_Pictographic}]/u;

function getGraphemeClusters(value: string) {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: 'grapheme',
    });
    return Array.from(segmenter.segment(value), segment => segment.segment);
  }

  return Array.from(value);
}

function isEmojiLike(value: string) {
  return (
    Array.from(value).some(char => {
      const codePoint = char.codePointAt(0);
      return codePoint != null && codePoint > 0x7f;
    }) && emojiLikeRegex.test(value)
  );
}

export function sanitizeMobileFlagInput(value: string) {
  return getGraphemeClusters(value).find(isEmojiLike) ?? '';
}

export function MobileFlagModal({
  value,
  description,
  recentFlags = [],
  onSave,
  onClose,
}: MobileFlagModalProps) {
  const { t } = useTranslation();
  const [nativeFlag, setNativeFlag] = useState(() =>
    sanitizeMobileFlagInput(shortcodeToNative(value ?? null)),
  );

  return (
    <Modal
      name="mobile-flag"
      onClose={onClose}
      containerProps={{
        style: {
          backgroundColor: theme.modalBackground,
          maxWidth: 360,
          minWidth: '90vw',
        },
      }}
    >
      {({ state }) => {
        const closeModal = () => state.close();

        return (
          <>
            <ModalHeader
              title={<ModalTitle title={t('Flag')} />}
              rightContent={<ModalCloseButton onPress={closeModal} />}
            />
            <View style={{ gap: 14 }}>
              <Text>
                {description ?? (
                  <Trans>
                    Choose one emoji as a flag for this transaction.
                  </Trans>
                )}
              </Text>
              <Input
                autoFocus
                autoCapitalize="none"
                autoCorrect="false"
                inputMode="text"
                aria-label={t('Flag emoji')}
                value={nativeFlag}
                onChangeValue={nextValue => {
                  setNativeFlag(sanitizeMobileFlagInput(nextValue));
                }}
                onPaste={event => {
                  event.preventDefault();
                  setNativeFlag(
                    sanitizeMobileFlagInput(
                      event.clipboardData.getData('text/plain'),
                    ),
                  );
                }}
                style={{
                  height: styles.mobileMinHeight,
                  textAlign: 'center',
                  fontSize: 28,
                }}
              />
              {recentFlags.length > 0 && (
                <View
                  data-testid="mobile-flag-recent-flags"
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    justifyContent: 'center',
                  }}
                >
                  {recentFlags.slice(0, MOBILE_RECENT_FLAGS_LIMIT).map(flag => {
                    const nativeRecentFlag = shortcodeToNative(flag);
                    if (!nativeRecentFlag) {
                      return null;
                    }

                    return (
                      <Button
                        key={flag}
                        aria-label={t('Use {{flag}} flag', {
                          flag: nativeRecentFlag,
                        })}
                        onPress={() => {
                          setNativeFlag(
                            sanitizeMobileFlagInput(nativeRecentFlag),
                          );
                        }}
                        style={{
                          width: styles.mobileMinHeight,
                          height: styles.mobileMinHeight,
                          padding: 0,
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 24 }}>{nativeRecentFlag}</Text>
                      </Button>
                    );
                  })}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  variant="primary"
                  style={{ flex: 1, height: styles.mobileMinHeight }}
                  onPress={() => {
                    onSave(nativeFlag ? nativeToShortcode(nativeFlag) : null);
                    closeModal();
                  }}
                >
                  <Trans>Save</Trans>
                </Button>
                <Button
                  style={{ flex: 1, height: styles.mobileMinHeight }}
                  onPress={() => {
                    onSave(null);
                    closeModal();
                  }}
                >
                  <Trans>Remove</Trans>
                </Button>
              </View>
            </View>
          </>
        );
      }}
    </Modal>
  );
}
