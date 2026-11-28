/** A few things to do, by what opened them. Choosing one closes the menu; if it waits, once it is done. (SPEC §15.8) */
import { createContext, useContext, type ReactNode } from 'react';
import { Divider } from './layout';
import { ListItem } from './ListItem';
import { Overlay } from './overlay';
import { settle } from './pending';
import { Floating, useAnchored, type PopoverProps } from './Popover';
import { useTheme } from './theme';

const Context = createContext<(() => void) | null>(null);

export interface MenuProps extends Omit<PopoverProps, 'children' | 'label'> {
  /** `MenuItem` and `MenuSeparator`. */
  children: ReactNode;
  /** Its name, for a screen reader. */
  label?: string;
}

export function Menu({ trigger, children, label, placement = 'bottom-start', onOpenChange, testID }: MenuProps) {
  const theme = useTheme();
  const anchored = useAnchored(trigger, onOpenChange);
  return (
    <>
      {anchored.trigger}
      <Overlay open={anchored.open} onClose={anchored.close} veil={false}>
        {(t) => (
          <Floating t={t} rect={anchored.rect} placement={placement} role="menu" label={label} padding={theme.size['space.1']} testID={testID}>
            <Context.Provider value={anchored.close}>{children}</Context.Provider>
          </Floating>
        )}
      </Overlay>
    </>
  );
}

export interface MenuItemProps {
  label: string;
  /** Before the label. */
  icon?: ReactNode;
  disabled?: boolean;
  /** When it is chosen. If it returns a promise, the row waits for it and the menu closes once it is fulfilled. */
  onSelect?: () => void | Promise<unknown>;
  testID?: string;
}

export function MenuItem({ label, icon, disabled, onSelect, testID }: MenuItemProps) {
  const theme = useTheme();
  const close = useContext(Context);
  if (!close) throw new Error('@fluxus-ui/native: a <MenuItem> goes inside a <Menu>.');
  return <ListItem role="menuitem" title={label} leading={icon} disabled={disabled} testID={testID} onPress={() => settle(onSelect?.(), close)} style={{ borderRadius: theme.size['radius.control'] }} />;
}

/** A rule between two groups of a menu. */
export function MenuSeparator() {
  const theme = useTheme();
  return <Divider style={{ marginBlock: theme.size['space.1'] }} />;
}
