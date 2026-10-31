# Rising Steps

A walker records the height of each step in order. Count how many steps are higher than the immediately preceding step. The first step has no predecessor and does not count.

## Input
The first line contains N (1 <= N <= 1000). The second line contains N integers between -1000000 and 1000000.

## Output
Print the number of indices i, starting from the second value, for which height[i] is strictly greater than height[i-1].

## Example
Input:
```text
5
2 5 5 1 8
```
Output:
```text
2
```

---
Original ZenJudge demo content. Distributed under GPL-3.0-only with the application source.
