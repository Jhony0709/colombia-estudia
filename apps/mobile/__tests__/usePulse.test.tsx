import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { pulse } from '../src/messages/api';
import { PULSE_MS, usePulse } from '../src/messages/usePulse';

jest.mock('../src/messages/api', () => ({ pulse: jest.fn() }));
const stamp = pulse as jest.MockedFunction<typeof pulse>;

function Probe({ id, onChange }: { id?: string; onChange: () => void }) {
  usePulse(id, onChange);
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  // En Jest no hay app: se la da por en primer plano.
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('usePulse', () => {
  it('calls back only when the stamp changes, every 5 s', async () => {
    stamp.mockResolvedValueOnce('a').mockResolvedValueOnce('a').mockResolvedValue('b');
    const onChange = jest.fn();
    await render(<Probe id="c-1" onChange={onChange} />);
    expect(stamp).toHaveBeenCalledWith('c-1');
    await act(async () => jest.advanceTimersByTime(PULSE_MS));
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(PULSE_MS));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('stops in the background and catches up on coming back', async () => {
    stamp.mockResolvedValue('a');
    let listener: (state: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, fn) => {
      listener = fn as (state: string) => void;
      return { remove: jest.fn() } as never;
    });
    const onChange = jest.fn();
    await render(<Probe onChange={onChange} />);
    await act(async () => listener('background'));
    const calls = stamp.mock.calls.length;
    await act(async () => jest.advanceTimersByTime(PULSE_MS * 3));
    expect(stamp.mock.calls.length).toBe(calls);
    await act(async () => listener('active'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
