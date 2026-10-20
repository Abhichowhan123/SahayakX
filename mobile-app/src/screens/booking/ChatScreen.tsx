import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation';
import { bookingApi } from '../../api';
import { io, Socket } from 'socket.io-client';
import { appLogger } from '../../utils/logger';
import { SPACING, BORDER_RADIUS, FONTS } from '../../constants';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Chat'>;
  route:      RouteProp<RootStackParamList, 'Chat'>;
};

type Message = {
  id?: string;
  bookingId: string;
  senderId: string;
  senderRole: 'customer' | 'worker';
  text: string;
  createdAt: string;
};

export default function ChatScreen({ navigation, route }: Props) {
  const { bookingId } = route.params;
  const { colors: themeColors } = useTheme();
  const { user } = useAuth();
  const myPhone = user?.phone ?? '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, []);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    // Load message history
    bookingApi.getMessages(bookingId)
      .then(({ data }) => {
        const history = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
        setMessages(history.map((m: any) => ({
          id: m.id || m._id,
          bookingId: m.bookingId,
          senderId: m.senderId,
          senderRole: m.senderRole,
          text: m.text,
          createdAt: m.createdAt,
        })));
        appLogger.info({ fn: 'useEffect', tag: 'ChatScreen_messagesLoaded', screen: 'Chat' }, 'Messages loaded', { bookingId, count: history.length });
      })
      .catch((err) => {
        appLogger.error({ fn: 'useEffect', tag: 'ChatScreen_messagesLoadFailed', screen: 'Chat' }, 'Failed to load messages', err);
      })
      .finally(() => setLoading(false));

    // Socket for real-time chat
    let socket: ReturnType<typeof io>;
    try {
      socket = io(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:80');
      socketRef.current = socket;
      socket.emit('join_booking', bookingId);

      socket.on('connect_error', (err) => {
        appLogger.error({ fn: 'useEffect', tag: 'ChatScreen_socketConnectError', screen: 'Chat' }, 'Socket connection error', err);
      });

      socket.on('new_message', (msg: any) => {
        if (msg.bookingId !== bookingId) return;
        setMessages((prev) => [...prev, {
          id: msg.id,
          bookingId: msg.bookingId,
          senderId: msg.sender,
          senderRole: msg.senderRole,
          text: msg.text,
          createdAt: msg.createdAt,
        }]);
        scrollToBottom();
      });
    } catch (err) {
      appLogger.error({ fn: 'useEffect', tag: 'ChatScreen_socketSetupFailed', screen: 'Chat' }, 'Failed to set up socket', err);
    }

    return () => { socketRef.current?.disconnect(); };
  }, [bookingId, scrollToBottom]);

  const isMe = (senderId: string) => senderId === myPhone;

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      socketRef.current?.emit('chat_message', {
        bookingId,
        sender: myPhone,
        text,
      });
      setInputText('');
      scrollToBottom();
    } catch (err: any) {
      appLogger.error({ fn: 'handleSend', tag: 'ChatScreen_sendFailed', screen: 'Chat' }, 'Failed to send message', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[styles.back, { color: themeColors.textPrimary }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>Chat</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={[styles.scroll, { backgroundColor: themeColors.background }]}
        contentContainerStyle={{ paddingVertical: SPACING.sm }}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg, idx) => {
          const me = isMe(msg.senderId);
          return (
            <View key={msg.id ?? idx} style={[styles.messageRow, me ? styles.messageRowMe : styles.messageRowOther]}>
              <View style={[styles.bubble, me ? styles.bubbleMe : styles.bubbleOther, me
                ? { backgroundColor: themeColors.primary }
                : { backgroundColor: themeColors.cardBg, borderColor: themeColors.border }]}>
                <Text style={[styles.bubbleText, me ? { color: colors.white } : { color: themeColors.textPrimary }]}>
                  {msg.text}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.inputContainer, { backgroundColor: themeColors.surface }]}
      >
        <View style={[styles.inputRow, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
          <TextInput
            style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.inputBg }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={themeColors.textMuted}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: themeColors.primary }]}
            onPress={handleSend}
            disabled={sending || !inputText.trim()}
          >
            {sending ? (
              <ActivityIndicator color={themeColors.white} size={16} />
            ) : (
              <Text style={[styles.sendBtnText, { color: themeColors.white }]}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.md, borderBottomWidth: 1 },
  back:          { fontSize: 24, width: 32 },
  headerTitle:   { fontSize: FONTS.sizes.base, fontWeight: '700' },
  scroll:        { flex: 1 },
  messageRow:    { flexDirection: 'row', marginHorizontal: SPACING.sm, marginVertical: SPACING.xs },
  messageRowMe:  { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  bubble:        { maxWidth: '75%', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.lg },
  bubbleMe:      { alignSelf: 'flex-end' },
  bubbleOther:   { alignSelf: 'flex-start', borderWidth: 1 },
  bubbleText:    { fontSize: FONTS.sizes.base },
  inputContainer: { padding: SPACING.sm },
  inputRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm, padding: SPACING.xs },
  input:         { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, textAlignVertical: 'top' },
  sendBtn:       { borderRadius: BORDER_RADIUS.lg, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, justifyContent: 'center', minWidth: 64, alignItems: 'center' },
  sendBtnText:   { fontSize: FONTS.sizes.sm, fontWeight: '700' },
});
