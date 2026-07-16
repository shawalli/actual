import type {
  CategoryEntity,
  CategoryGroupEntity,
  TransactionEntity,
} from '@actual-app/core/types/models';

type GiftCardCategory = Pick<CategoryEntity, 'id' | 'name' | 'hidden'>;

type GiftCardCategoryGroup = {
  is_income?: CategoryGroupEntity['is_income'];
  categories?: readonly GiftCardCategory[];
};

type GiftCardFooterTransaction = Pick<
  TransactionEntity,
  'account' | 'amount' | 'isGiftCard' | 'is_child'
>;

export function getGiftCardCategoryId(
  categoryGroups: readonly GiftCardCategoryGroup[],
) {
  const incomeCategories =
    categoryGroups.find(group => group.is_income)?.categories ?? [];

  return (
    incomeCategories.find(
      category => !category.hidden && category.name.toLowerCase() === 'income',
    )?.id ?? incomeCategories.find(category => !category.hidden)?.id
  );
}

export function shouldShowGiftCardActions({
  isAdding,
  transactions,
}: {
  isAdding: boolean;
  transactions: readonly GiftCardFooterTransaction[];
}) {
  const [transaction, ...childTransactions] = transactions;

  return (
    isAdding &&
    !!transaction?.account &&
    childTransactions.some(
      childTransaction =>
        !!childTransaction.is_child && !!childTransaction.isGiftCard,
    ) &&
    childTransactions.some(
      childTransaction =>
        !childTransaction.isGiftCard && childTransaction.amount !== 0,
    )
  );
}
