import { fireEvent, render, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { ThemeProvider } from '@fluxus-ui/native';
import { copy } from '../src/copy';
import { mediaUrl } from '../src/messages/api';
import { MediaMessage } from '../src/messages/MediaMessage';
import { theme } from '../theme/alba';

jest.mock('../src/messages/api', () => ({
  mediaUrl: jest.fn(async () => 'https://storage.test/signed'),
}));
const status = useAudioPlayerStatus as jest.Mock;
const player = jest.requireMock('expo-audio').player as { play: jest.Mock; pause: jest.Mock };
const path = '/api/conversations/c-1/messages/m-1/media';

async function show(type: string, name: string | null = null) {
  await render(
    <ThemeProvider theme={theme} mode="light">
      <MediaMessage media={{ type, name, url: path }} />
    </ThemeProvider>
  );
}

afterEach(() => jest.clearAllMocks());

describe('MediaMessage', () => {
  it('plays a voice note from its signed URL', async () => {
    await show('audio');
    const button = await screen.findByRole('button', { name: copy.audio.play });
    expect(mediaUrl).toHaveBeenCalledWith(path);
    expect(useAudioPlayer).toHaveBeenLastCalledWith({ uri: 'https://storage.test/signed' });
    await fireEvent.press(button);
    expect(player.play).toHaveBeenCalled();
  });

  it('says pause while it plays', async () => {
    status.mockReturnValue({ playing: true, currentTime: 3, duration: 12, didJustFinish: false });
    await show('audio');
    await fireEvent.press(await screen.findByRole('button', { name: copy.audio.pause }));
    expect(player.pause).toHaveBeenCalled();
    expect(
      screen.getByRole('slider', { name: copy.audio.position, value: { text: '0:03 / 0:12' } })
    ).toBeTruthy();
  });

  it('says so when the voice note cannot be played', async () => {
    status.mockReturnValue({ playing: false, currentTime: 0, duration: 0, error: 'decode failed' });
    await show('audio');
    expect(await screen.findByText(copy.loadFailed)).toBeTruthy();
  });

  it('shows a photo with its name', async () => {
    await show('image', 'cedula.jpg');
    expect(await screen.findByRole('image', { name: `${copy.photo}: cedula.jpg` })).toBeTruthy();
  });

  it('opens a document in the system viewer', async () => {
    await show('document', 'diploma.pdf');
    await fireEvent.press(screen.getByRole('link', { name: copy.file('diploma.pdf') }));
    await screen.findByRole('link', { name: copy.file('diploma.pdf') });
    expect(openBrowserAsync).toHaveBeenCalledWith('https://storage.test/signed');
  });
});
