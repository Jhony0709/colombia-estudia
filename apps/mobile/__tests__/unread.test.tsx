import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { setUnread, useUnread } from '../src/notifications/unread';

function Probe() {
  return <Text>{String(useUnread())}</Text>;
}

it('tells the tab when the count changes', async () => {
  await render(<Probe />);
  expect(screen.getByText('0')).toBeTruthy();
  await act(async () => setUnread(3));
  expect(screen.getByText('3')).toBeTruthy();
});
