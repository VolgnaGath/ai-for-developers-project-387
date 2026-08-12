import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'orange',
  primaryShade: 6,
  autoContrast: true,
  defaultRadius: 'md',
  fontSmoothing: true,
  headings: {
    fontWeight: '700',
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
        fw: 600,
      },
    },
    Card: {
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
    },
  },
  other: {
    contentWidth: 1120,
    headerHeight: 60,
  },
});
