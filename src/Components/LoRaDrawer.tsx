import { BaseDrawer } from './BaseDrawer'
import { LoRaPanel } from './Settings/LoRaPanel'

interface LoRaDrawerProps {
    isVisible: boolean
    onClose: () => void
}

export function LoRaDrawer({ isVisible, onClose }: LoRaDrawerProps) {
    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={onClose}
            fullHeight="90dvh"
            header={{
                title: 'WhisperNet',
                badge: 'BETA',
            }}
        >
            <LoRaPanel />
        </BaseDrawer>
    )
}
