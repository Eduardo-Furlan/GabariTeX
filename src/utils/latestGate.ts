export function createLatestGate() {
  let current = 0;
  return {
    begin: () => ++current,
    isCurrent: (token: number) => token === current,
  };
}

