import { test as base, expect } from '@playwright/test';
import { defineNetworkFixture, type NetworkFixture } from '@msw/playwright';
import { handlers, resetMockDb } from '../src/test/mocks/handlers';

export const test = base.extend<{ network: NetworkFixture }>({
  network: [
    async ({ context }, use) => {
      resetMockDb();
      const network = defineNetworkFixture({ context, handlers });
      await network.enable();
      await use(network);
      await network.disable();
    },
    { auto: true },
  ],
});

export { expect };
