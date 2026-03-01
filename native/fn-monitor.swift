import Foundation
import CoreGraphics

// Minimal Swift helper that monitors Fn (Globe) key press/release
// via CGEventTap and prints events to stdout.
// Electron spawns this as a child process and reads stdout line by line.

// Disable stdout buffering so Electron receives lines immediately
setbuf(stdout, nil)

var fnDown = false

func handleEvent(proxy: CGEventTapProxy, type: CGEventType, event: CGEvent, refcon: UnsafeMutableRawPointer?) -> Unmanaged<CGEvent>? {
    if type == .flagsChanged {
        let flags = event.flags
        let fn = flags.contains(.maskSecondaryFn)
        if fn != fnDown {
            fnDown = fn
            print(fn ? "fn-down" : "fn-up")
        }
    }
    // If tap is disabled by the system, re-enable it
    if type == .tapDisabledByUserInput || type == .tapDisabledByTimeout {
        if let tap = refcon?.assumingMemoryBound(to: CFMachPort.self).pointee {
            CGEvent.tapEnable(tap: tap, enable: true)
        }
    }
    return Unmanaged.passRetained(event)
}

guard let eventTap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: CGEventMask(1 << CGEventType.flagsChanged.rawValue),
    callback: handleEvent,
    userInfo: nil
) else {
    fputs("Error: Failed to create event tap. Check Accessibility permissions.\n", stderr)
    exit(1)
}

let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: eventTap, enable: true)

CFRunLoopRun()
