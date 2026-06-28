-- +goose Up
-- +goose StatementBegin
UPDATE articles SET body = E'## When to use two pointers

Many array problems ask for a pair of indices or a subarray with a property. If the input can be scanned from both ends (sorted array, palindrome, container with two boundaries), two pointers often give O(n) time and O(1) extra space.

## Checklist before coding

1. Can you sort or is the array already sorted?
2. Do you need all pairs or only one optimal pair?
3. Can you move the left or right pointer based on a comparison?

## Template

```python
def two_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return left, right
        if total < target:
            left += 1
        else:
            right -= 1
    return -1, -1
```

Use **two pointers** when the array is sorted or you can reason about monotonic movement.

## Next step

After reading, run solo algorithms training from the practice block below.'
WHERE slug = 'arrays-and-two-pointers';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
SELECT 1;
-- +goose StatementEnd
