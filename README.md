# exam-protector-mobile

Mobile companion to **[Phone-Proctor](https://github.com/Mpratyush54/Phone-Proctor)** — streams camera frames and device sensors to the AI proctoring backend over WebSocket during remote exams.

## Role in the stack

```
exam-protector-mobile  --WebSocket-->  Phone-Proctor (Python CV + fusion)
```

- Camera frame stream for vision analysis
- Motion / related sensor telemetry for fusion
- Client-side signals (app switch, screenshot attempts) where the OS allows
- Low-latency alert channel back to the proctor path

## Stack

Typically React Native / JS bridge with native Android (Kotlin) hooks for device-level controls.

## Related

- Backend: [Phone-Proctor](https://github.com/Mpratyush54/Phone-Proctor)
- Portfolio: [pratyushes.dev](https://pratyushes.dev)

## Status

Active development — private APK distribution for enrolled test environments.
