import { fireEvent, render, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { ThemeProvider } from '@fluxus-ui/native';
import { ApiError } from '../src/api';
import { copy } from '../src/copy';
import { getAccounts, pay, type Account } from '../src/account/api';
import { AccountScreen } from '../src/account/AccountScreen';
import { theme } from '../theme/alba';

jest.mock('../src/account/api', () => ({ getAccounts: jest.fn(), pay: jest.fn() }));
const accounts = getAccounts as jest.MockedFunction<typeof getAccounts>;
const start = pay as jest.MockedFunction<typeof pay>;
const t = copy.account;

const account = (over: Partial<Account> = {}): Account => ({
  enrollmentId: 'e-1',
  cohort: { programName: 'Bachillerato', name: 'Cohorte 2026-1' },
  status: 'OVERDUE',
  installments: [
    {
      id: 'i-1',
      position: 1,
      amount: 120000,
      paid: 120000,
      dueOn: '2026-10-01',
      status: 'PAID',
      overdue: false,
      unlocks: [],
    },
    {
      id: 'i-2',
      position: 2,
      amount: 120000,
      paid: 0,
      dueOn: '2026-11-01',
      status: 'OPEN',
      overdue: true,
      unlocks: ['Etapa 2'],
    },
  ],
  payments: [
    {
      id: 'p-1',
      installmentPosition: 1,
      amount: 120000,
      method: 'GATEWAY',
      paidAt: '2026-10-01T15:00:00.000Z',
      confirmedAt: '2026-10-01T15:05:00.000Z',
      voidedAt: null,
    },
  ],
  agreements: [],
  summary: {
    paid: 120000,
    pending: 120000,
    overdue: 120000,
    next: { id: 'i-2', position: 2, amount: 120000, dueOn: '2026-11-01' },
  },
  ...over,
});

async function open() {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <AccountScreen />
    </ThemeProvider>
  );
  await screen.findByText(t.title);
}

beforeEach(() => accounts.mockResolvedValue({ accounts: [account()], onlinePayment: true }));
afterEach(() => jest.clearAllMocks());

describe('AccountScreen', () => {
  it('says how the account is, with what the server says', async () => {
    await open();
    expect(await screen.findByText(t.statuses.OVERDUE)).toBeTruthy();
    expect(
      screen.getByText(t.nextInstallment(2, '$ 120.000', '1 de noviembre de 2026'))
    ).toBeTruthy();
    expect(screen.getByText(t.opens(2, 'Etapa 2'))).toBeTruthy();
  });

  it('pays the installment the server chose, in the browser of the app, and reloads', async () => {
    start.mockResolvedValue({ url: 'https://checkout.bold.co/x', delivery: 'redirect' });
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: t.payOnline }));
    expect(start).toHaveBeenCalledWith('i-2', 'redirect');
    expect(openBrowserAsync).toHaveBeenCalledWith('https://checkout.bold.co/x');
    expect(accounts).toHaveBeenCalledTimes(2);
  });

  it('sends the link by email', async () => {
    start.mockResolvedValue({ url: 'x', delivery: 'email' });
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: t.payByEmail }));
    expect(await screen.findByText(t.payEmailSent)).toBeTruthy();
    expect(openBrowserAsync).not.toHaveBeenCalled();
  });

  it('says when paying online failed', async () => {
    start.mockRejectedValue(new ApiError(409, 'CONFLICT', 'x'));
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: t.payOnline }));
    expect(await screen.findByText(t.payError)).toBeTruthy();
  });

  it('offers no online payment when the server has none', async () => {
    accounts.mockResolvedValue({ accounts: [account()], onlinePayment: false });
    await open();
    await screen.findByText(t.statuses.OVERDUE);
    expect(screen.queryByRole('button', { name: t.payOnline })).toBeNull();
    expect(screen.getByRole('link', { name: t.transferData })).toBeTruthy();
  });

  it('says when nothing is left to pay', async () => {
    accounts.mockResolvedValue({
      accounts: [
        account({
          status: 'CURRENT',
          summary: { paid: 240000, pending: 0, overdue: 0, next: null },
        }),
      ],
      onlinePayment: true,
    });
    await open();
    expect(await screen.findByText(t.allPaid)).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.payOnline })).toBeNull();
  });

  it('says there is no account on a 404', async () => {
    accounts.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'x'));
    await open();
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });

  it('lists the installments and the payments', async () => {
    await open();
    await fireEvent.press(await screen.findByText(t.installments));
    expect(await screen.findByText(t.overdue)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.payments));
    expect(await screen.findByText(t.confirmed)).toBeTruthy();
  });
});
