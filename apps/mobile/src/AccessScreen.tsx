import { useRef, useState, type ComponentRef } from 'react';
import { TextInput } from 'react-native';
import { Button, Message, Text, TextField } from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { copy } from './copy';
import { failure, useSession, type Notice } from './SessionProvider';
import { recover } from './session';
import { WebLink } from './ui/WebLink';

function validate(email: string, password: string) {
  const mail = email.trim();
  return {
    email: mail === '' ? copy.emailMissing : mail.includes('@') ? undefined : copy.emailInvalid,
    password: password === '' ? copy.passwordMissing : undefined,
  };
}

function NoticeView({ notice }: { notice: Notice }) {
  return (
    <>
      <Message tone={notice.tone} title={notice.title}>
        {notice.text}
      </Message>
      {notice.link && <WebLink>{copy.openWeb}</WebLink>}
    </>
  );
}

/** «Sin sesión» y el código del segundo factor (reference/03-ui/movil.md, M0). */
export function AccessScreen() {
  const { state, signIn, verify, cancelMfa } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  // El botón espera su promesa; el «Ir» del teclado no pasa por él y podría mandar dos veces.
  const sending = useRef(false);
  const notice = state.kind === 'out' || state.kind === 'mfa' ? state.notice : undefined;
  const [recovering, setRecovering] = useState(false);
  const [recovered, setRecovered] = useState<Notice | null>(null);

  async function once(action: () => Promise<void>) {
    if (sending.current) return;
    sending.current = true;
    try {
      await action();
    } finally {
      sending.current = false;
    }
  }

  function submit() {
    const found = validate(email, password);
    setErrors(found);
    if (found.email || found.password) return;
    return once(async () => {
      await signIn(email.trim(), password);
      setPassword('');
    });
  }

  function check() {
    const missing = /^\d{6}$/.test(code) ? undefined : copy.mfaMissing;
    setErrors({ code: missing });
    if (missing) return;
    return once(async () => {
      await verify(code);
      setCode('');
    });
  }

  function ask() {
    const mail = email.trim();
    const problem =
      mail === '' ? copy.emailMissing : mail.includes('@') ? undefined : copy.emailInvalid;
    setErrors({ email: problem });
    if (problem) return;
    return recover(mail).then(
      (answer) => setRecovered({ tone: 'info', title: copy.recover, text: answer.message }),
      (error: unknown) => {
        setRecovered({ ...failure(error), title: copy.recover });
        throw error;
      }
    );
  }

  if (recovering) {
    return (
      <Screen scroll>
        <Text variant="heading">{copy.recover}</Text>
        <Text tone="muted">{copy.recoverInstructions}</Text>
        {recovered && <NoticeView notice={recovered} />}
        <TextField
          label={copy.email}
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="send"
          onSubmitEditing={() => void ask()?.catch(() => undefined)}
        />
        <Button variant="primary" onPress={ask}>
          {copy.recoverSubmit}
        </Button>
        <Button
          variant="ghost"
          onPress={() => {
            setRecovering(false);
            setRecovered(null);
            setErrors({});
          }}
        >
          {copy.backToLogin}
        </Button>
      </Screen>
    );
  }

  if (state.kind === 'mfa') {
    return (
      <Screen scroll>
        <Text variant="heading">{copy.mfaTitle}</Text>
        <Text tone="muted">{copy.mfaIntro}</Text>
        {notice && <NoticeView notice={notice} />}
        <TextField
          label={copy.mfaCode}
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
          error={errors.code}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          returnKeyType="go"
          onSubmitEditing={() => void check()}
        />
        <Button variant="primary" onPress={check}>
          {copy.mfaSubmit}
        </Button>
        <Button variant="ghost" onPress={cancelMfa}>
          {copy.mfaBack}
        </Button>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text variant="heading">{copy.title}</Text>
      <Text tone="muted">{copy.intro}</Text>
      {notice && <NoticeView notice={notice} />}
      <TextField
        label={copy.email}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={passwordRef}
        label={copy.password}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        reveal={{ show: copy.showPassword, hide: copy.hidePassword }}
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <Button variant="primary" onPress={submit}>
        {copy.submit}
      </Button>
      <Button
        variant="ghost"
        onPress={() => {
          setErrors({});
          setRecovering(true);
        }}
      >
        {copy.forgot}
      </Button>
    </Screen>
  );
}
