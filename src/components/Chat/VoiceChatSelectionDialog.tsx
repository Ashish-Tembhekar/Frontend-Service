
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Sparkles, MessageSquare } from 'lucide-react';
import { appConfig } from '@/lib/config';

interface VoiceChatSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (provider: 'kokoro' | 'chatterbox') => void;
    defaultProvider?: 'kokoro' | 'chatterbox';
}

export function VoiceChatSelectionDialog({
    isOpen,
    onClose,
    onConfirm,
    defaultProvider = 'kokoro'
}: VoiceChatSelectionDialogProps) {
    // Default to chatterbox if kokoro is unavailable
    const initialProvider = appConfig.isKokoroAvailable ? defaultProvider : 'chatterbox';
    const [selected, setSelected] = React.useState<'kokoro' | 'chatterbox'>(initialProvider);

    const handleConfirm = () => {
        onConfirm(selected);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Start Voice Chat</DialogTitle>
                    <DialogDescription>
                        Choose your preferred Text-to-Speech engine for this session.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <RadioGroup
                        defaultValue={selected}
                        value={selected}
                        onValueChange={(val) => setSelected(val as 'kokoro' | 'chatterbox')}
                        className="grid gap-4"
                    >
                        {/* Kokoro Option */}
                        <div>
                            <RadioGroupItem
                                value="kokoro"
                                id="kokoro"
                                className="peer sr-only"
                                disabled={!appConfig.isKokoroAvailable}
                            />
                            <Label
                                htmlFor="kokoro"
                                className={`flex items-center justify-between rounded-md border-2 border-muted bg-popover p-4 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${appConfig.isKokoroAvailable
                                        ? 'hover:bg-accent hover:text-accent-foreground cursor-pointer'
                                        : 'opacity-50 cursor-not-allowed'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="rounded-full bg-indigo-100 p-2 text-indigo-600">
                                        <Sparkles className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium leading-none">
                                            Kokoro TTS
                                            {!appConfig.isKokoroAvailable && (
                                                <span className="ml-2 text-xs text-gray-400">(Unavailable)</span>
                                            )}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {appConfig.isKokoroAvailable
                                                ? 'High quality, natural sounding voices.'
                                                : 'Service not configured'}
                                        </p>
                                    </div>
                                </div>
                                <div className="h-4 w-4 rounded-full border border-primary opacity-0 peer-data-[state=checked]:opacity-100 bg-primary" />
                            </Label>
                        </div>

                        {/* Chatterbox Option */}
                        <div>
                            <RadioGroupItem value="chatterbox" id="chatterbox" className="peer sr-only" />
                            <Label
                                htmlFor="chatterbox"
                                className="flex items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="rounded-full bg-orange-100 p-2 text-orange-600">
                                        <MessageSquare className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium leading-none">Chatterbox TTS</p>
                                        <p className="text-sm text-muted-foreground">Standard quality, reliable streaming.</p>
                                    </div>
                                </div>
                                <div className="h-4 w-4 rounded-full border border-primary opacity-0 peer-data-[state=checked]:opacity-100 bg-primary" />
                            </Label>
                        </div>
                    </RadioGroup>
                </div>

                <DialogFooter className="sm:justify-end">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleConfirm}>Start Chat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
