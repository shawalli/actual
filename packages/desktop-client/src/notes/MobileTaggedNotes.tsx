import React from 'react';

import { Text } from '@actual-app/components/text';

import { useTagCSS } from '@desktop-client/hooks/useTagCSS';

type MobileTaggedNotesProps = {
  content: string;
  tag: string;
  separator: string;
  isPerson?: boolean;
};

export function MobileTaggedNotes({
  content,
  tag,
  separator,
  isPerson,
}: MobileTaggedNotesProps) {
  const getTagCSS = useTagCSS();
  return (
    <>
      <Text className={getTagCSS(tag, { compact: true, isPerson })}>
        {content}
      </Text>
      {separator}
    </>
  );
}
