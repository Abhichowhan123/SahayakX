import { Alert, Platform } from 'react-native';

/**
 * react-native-web ships a no-op `Alert`, so on web every Alert.alert call is
 * silently dropped — including its button callbacks. These helpers keep the
 * native alert on iOS/Android and fall back to the browser dialogs on web.
 */

export const showAlert = (title: string, message?: string): void => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(message ? `${title}\n\n${message}` : title);
    }
    return;
  }
  Alert.alert(title, message);
};

export const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  confirmLabel = 'Yes',
): void => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message ? `${title}\n\n${message}` : title)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'No',  style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
};
