import { useEffect, useState } from 'react'
import { Keyboard } from '@capacitor/keyboard'
import { isNative } from '../lib/native'

// Écart minimal entre fenêtre et zone visible pour considérer le clavier ouvert
// (la barre d'adresse de Safari fait varier visualViewport de quelques dizaines de px).
const WEB_KEYBOARD_MIN_PX = 120

// Clavier ouvert ? Natif : plugin Keyboard (resize: 'native', la WebView rétrécit
// d'elle-même). Web : visualViewport, comme initFieldReveal dans lib/native.
export function useKeyboardOpen() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isNative) {
      const handles = [
        Keyboard.addListener('keyboardWillShow', () => setOpen(true)),
        Keyboard.addListener('keyboardDidShow', () => setOpen(true)),
        Keyboard.addListener('keyboardWillHide', () => setOpen(false)),
      ]
      return () => handles.forEach(handle => handle.then(h => h.remove()).catch(() => {}))
    }
    const viewport = window.visualViewport
    if (!viewport) return undefined
    const update = () => setOpen(window.innerHeight - viewport.height > WEB_KEYBOARD_MIN_PX)
    viewport.addEventListener('resize', update)
    return () => viewport.removeEventListener('resize', update)
  }, [])

  return open
}
