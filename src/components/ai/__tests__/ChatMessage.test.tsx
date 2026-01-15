/**
 * Unit tests for ChatMessage component
 * Tests chat message display with markdown rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessage } from '../ChatMessage';
import { ChatMessage as ChatMessageType } from '../../../services/aiService';

// Mock ReactMarkdown
vi.mock('react-markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>
}));

// Mock remark-gfm
vi.mock('remark-gfm', () => ({
    default: () => {}
}));

// Mock syntax highlighter
vi.mock('react-syntax-highlighter', () => ({
    Prism: ({ children }: { children: string }) => <pre data-testid="code-block">{children}</pre>
}));

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
    vscDarkPlus: {}
}));

// Mock ActionCard
vi.mock('../ActionCard', () => ({
    ActionCard: ({ type }: { type: string }) => <div data-testid="action-card">{type}</div>
}));

describe('ChatMessage', () => {
    const mockOnCopy = vi.fn();
    const mockOnUpgrade = vi.fn();

    const userMessage: ChatMessageType = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, how can I improve my compliance score?',
        timestamp: new Date('2024-01-15T10:00:00')
    };

    const assistantMessage: ChatMessageType = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Here are some recommendations to improve your compliance score:',
        timestamp: new Date('2024-01-15T10:00:05')
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('user message', () => {
        it('renders user message content', () => {
            render(
                <ChatMessage
                    message={userMessage}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(screen.getByText('Hello, how can I improve my compliance score?')).toBeInTheDocument();
        });

        it('renders user label', () => {
            render(
                <ChatMessage
                    message={userMessage}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(screen.getByText('Vous')).toBeInTheDocument();
        });

        it('renders timestamp', () => {
            render(
                <ChatMessage
                    message={userMessage}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(screen.getByText('10:00')).toBeInTheDocument();
        });
    });

    describe('assistant message', () => {
        it('renders assistant message with markdown', () => {
            render(
                <ChatMessage
                    message={assistantMessage}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(screen.getByTestId('markdown')).toBeInTheDocument();
        });

        it('renders Sentinel AI label', () => {
            render(
                <ChatMessage
                    message={assistantMessage}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(screen.getByText('Sentinel AI')).toBeInTheDocument();
        });

        it('renders copy button', () => {
            render(
                <ChatMessage
                    message={assistantMessage}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(screen.getByLabelText('Copier la réponse')).toBeInTheDocument();
        });

        it('calls onCopy when copy button clicked', () => {
            render(
                <ChatMessage
                    message={assistantMessage}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            fireEvent.click(screen.getByLabelText('Copier la réponse'));

            expect(mockOnCopy).toHaveBeenCalledWith(assistantMessage.content, 'msg-2');
        });

        it('shows "Copié" when message is copied', () => {
            render(
                <ChatMessage
                    message={assistantMessage}
                    onCopy={mockOnCopy}
                    copiedId="msg-2"
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(screen.getByText('Copié')).toBeInTheDocument();
        });
    });

    describe('error message', () => {
        const errorMessage: ChatMessageType = {
            id: 'msg-3',
            role: 'assistant',
            content: 'An error occurred',
            timestamp: new Date(),
            isError: true
        };

        it('renders error message', () => {
            render(
                <ChatMessage
                    message={errorMessage}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(screen.getByText('An error occurred')).toBeInTheDocument();
        });

        it('does not render copy button for error', () => {
            render(
                <ChatMessage
                    message={errorMessage}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(screen.queryByLabelText('Copier la réponse')).not.toBeInTheDocument();
        });
    });

    describe('quota error', () => {
        const quotaError: ChatMessageType = {
            id: 'msg-4',
            role: 'assistant',
            content: 'Quota exceeded. Please upgrade.',
            timestamp: new Date(),
            isError: true
        };

        it('shows upgrade button for quota error', () => {
            render(
                <ChatMessage
                    message={quotaError}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(screen.getByLabelText('Mettre à niveau mon plan')).toBeInTheDocument();
        });

        it('calls onUpgrade when upgrade button clicked', () => {
            render(
                <ChatMessage
                    message={quotaError}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            fireEvent.click(screen.getByLabelText('Mettre à niveau mon plan'));

            expect(mockOnUpgrade).toHaveBeenCalled();
        });
    });

    describe('action card', () => {
        const messageWithAction: ChatMessageType = {
            id: 'msg-5',
            role: 'assistant',
            content: '{"text": "I recommend this action", "action": {"type": "CREATE_RISK", "payload": {}}}',
            timestamp: new Date()
        };

        it('renders action card when message contains action', () => {
            render(
                <ChatMessage
                    message={messageWithAction}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(screen.getByTestId('action-card')).toBeInTheDocument();
        });
    });

    describe('styling', () => {
        it('applies user message styling', () => {
            const { container } = render(
                <ChatMessage
                    message={userMessage}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(container.querySelector('.flex-row-reverse')).toBeInTheDocument();
        });

        it('applies assistant message styling', () => {
            const { container } = render(
                <ChatMessage
                    message={assistantMessage}
                    onCopy={mockOnCopy}
                    copiedId={null}
                    onUpgrade={mockOnUpgrade}
                />
            );

            expect(container.querySelector('.flex-row-reverse')).not.toBeInTheDocument();
        });
    });
});
