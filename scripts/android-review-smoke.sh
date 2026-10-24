#!/usr/bin/env bash
# Launch a public review APK on a disposable GitHub-hosted Android emulator.
set -euo pipefail
umask 077

fail() { printf '%s\n' "$*" >&2; exit 1; }

# Keep untrusted workflow input out of shell expressions and SDK commands.
[[ ${APK_URL:-} =~ ^https://expo\.dev/artifacts/eas/[A-Za-z0-9_-]+\.apk$ ]] ||
  fail 'APK_URL must match https://expo.dev/artifacts/eas/<artifact>.apk exactly.'
[[ ${GITHUB_ACTIONS:-} == true && ${RUNNER_OS:-} == Linux ]] ||
  fail 'Run this smoke test on a disposable GitHub-hosted Linux runner.'

sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}
[[ -n "$sdk" && -d "$sdk" ]] || fail 'The runner Android SDK is unavailable.'
sdkmanager="$sdk/cmdline-tools/latest/bin/sdkmanager"
avdmanager="$sdk/cmdline-tools/latest/bin/avdmanager"
adb="$sdk/platform-tools/adb"
for tool in "$sdkmanager" "$avdmanager" "$adb"; do
  [[ -x "$tool" ]] || fail "Required runner Android SDK tool unavailable: $tool"
done
for tool in curl timeout python3 unzip; do
  command -v "$tool" >/dev/null || fail "Required runner tool unavailable: $tool"
done
[[ -s "$sdk/licenses/android-sdk-license" ]] ||
  fail 'Existing Android SDK license missing; this workflow does not accept licenses.'

work=$(mktemp -d "${RUNNER_TEMP:?}/anvira-android.XXXXXX")
evidence=${ANDROID_SMOKE_EVIDENCE_DIR:?}
mkdir -p "$evidence"
export ANDROID_AVD_HOME="$work/avd"
export ANDROID_USER_HOME="$work/android-user"
mkdir -p "$ANDROID_AVD_HOME" "$ANDROID_USER_HOME"
serial=emulator-5554
package=com.anvira.services
emulator_pid=''
logcat_pid=''
booted=false

sanitize() {
  python3 - "$1" "$2" <<'PY'
import pathlib, re, sys
source, destination = map(pathlib.Path, sys.argv[1:])
text = source.read_text(errors="replace") if source.exists() else ""
text = re.sub(r"(?i)Bearer\s+[^\s,\"']+", "Bearer [REDACTED]", text)
text = re.sub(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[JWT REDACTED]", text)
text = re.sub(r"\bAIza[A-Za-z0-9_-]+", "[API KEY REDACTED]", text)
text = re.sub(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", "[EMAIL REDACTED]", text)
text = re.sub(r"(?i)((?:password|idToken|accessToken|refreshToken|api[_-]?key|authorization)\s*[=:]\s*)[^\s,}]+", r"\1[REDACTED]", text)
destination.write_text(text)
PY
}

cleanup() {
  result=$?
  trap - EXIT
  set +e
  if [[ "$booted" == true ]]; then
    "$adb" -s "$serial" exec-out screencap -p > "$evidence/launch.png"
    "$adb" -s "$serial" logcat -d -v threadtime -b main -b system -b crash \
      'ReactNativeJS:V' 'ReactNative:V' 'AndroidRuntime:V' 'libc:F' 'DEBUG:F' '*:S' \
      > "$work/logcat-final.log" 2>/dev/null &&
      mv "$work/logcat-final.log" "$work/logcat.log"
  fi
  if [[ -n "$logcat_pid" ]]; then
    kill "$logcat_pid" 2>/dev/null
    wait "$logcat_pid" 2>/dev/null
  fi
  for name in logcat emulator sdk avd install launch activities; do
    sanitize "$work/$name.log" "$evidence/$name.log"
  done
  printf 'Android API 35 Google APIs x86_64; package %s; exit %s\n' "$package" "$result" > "$evidence/result.txt"
  if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
    printf '### Android release launch smoke test\n\nExit status: %s. See the Android review launch artifact for sanitized logs and the final emulator screenshot. No account was signed in.\n' "$result" >> "$GITHUB_STEP_SUMMARY"
  fi
  "$adb" -s "$serial" emu kill >/dev/null 2>&1
  if [[ -n "$emulator_pid" ]]; then kill "$emulator_pid" 2>/dev/null; fi
  rm -rf "$work"
  exit "$result"
}
trap cleanup EXIT

has_launch_errors() {
  grep -Eq 'FATAL EXCEPTION|Fatal signal|Abort message:|[[:space:]][EF][[:space:]]+ReactNativeJS[[:space:]]*:|ReactNativeJS.*(Uncaught|Unhandled|ReferenceError|TypeError|Invariant Violation)' "$work/logcat.log"
}

# Reuse only licenses already accepted in the GitHub runner image. EOF prevents
# sdkmanager from accepting a new license; any missing acceptance fails clearly.
image='system-images;android-35;google_apis;x86_64'
if ! timeout 420 "$sdkmanager" --sdk_root="$sdk" --install emulator "$image" \
  < /dev/null > "$work/sdk.log" 2>&1; then
  fail 'Android image/tool installation failed; inspect sdk.log. No new licenses were accepted.'
fi
emulator="$sdk/emulator/emulator"
[[ -x "$emulator" ]] || fail 'Android emulator unavailable after SDK setup.'
[[ -e /dev/kvm ]] || fail 'GitHub runner does not expose /dev/kvm for hardware acceleration.'
if [[ ! -r /dev/kvm || ! -w /dev/kvm ]]; then
  sudo chown "$(id -u):$(id -g)" /dev/kvm
fi
[[ -r /dev/kvm && -w /dev/kvm ]] || fail 'Cannot access runner KVM acceleration.'

curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  --retry 2 --connect-timeout 20 --max-time 240 --max-filesize 524288000 \
  --output "$work/review.apk" "$APK_URL"
unzip -tq "$work/review.apk" > /dev/null || fail 'Downloaded APK ZIP integrity check failed.'
sha256sum "$work/review.apk" | cut -d ' ' -f 1 > "$evidence/apk.sha256"
printf '%s\n' "$APK_URL" > "$evidence/apk-source.txt"

printf 'no\n' | "$avdmanager" create avd --force --name anvira-review \
  --package "$image" --device pixel_6 > "$work/avd.log" 2>&1
"$emulator" -avd anvira-review -port 5554 -no-window -no-audio -no-boot-anim \
  -no-snapshot -wipe-data -gpu swiftshader -accel on -memory 2048 \
  > "$work/emulator.log" 2>&1 &
emulator_pid=$!
"$adb" start-server > /dev/null
for ((attempt = 0; attempt < 180; attempt++)); do
  kill -0 "$emulator_pid" 2>/dev/null || fail 'Android emulator exited before boot.'
  if [[ $("$adb" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r') == 1 ]]; then
    booted=true
    break
  fi
  sleep 2
done
[[ "$booted" == true ]] || fail 'Android emulator did not finish booting within six minutes.'
"$adb" -s "$serial" shell input keyevent KEYCODE_WAKEUP
"$adb" -s "$serial" shell wm dismiss-keyguard
if ! "$adb" -s "$serial" install "$work/review.apk" > "$work/install.log" 2>&1; then
  fail 'APK installation failed; inspect install.log for the Android installer error.'
fi
"$adb" -s "$serial" logcat -c
"$adb" -s "$serial" logcat -v threadtime -b main -b system -b crash \
  'ReactNativeJS:V' 'ReactNative:V' 'AndroidRuntime:V' 'libc:F' 'DEBUG:F' '*:S' \
  > "$work/logcat.log" 2>&1 &
logcat_pid=$!
if ! "$adb" -s "$serial" shell am start -W -n "$package/.MainActivity" \
  > "$work/launch.log" 2>&1; then
  fail 'Android could not start MainActivity; inspect launch.log.'
fi
if grep -Eq 'Error:|Exception|Status: (timeout|error)' "$work/launch.log"; then
  fail 'Android reported an activity launch error; inspect launch.log.'
fi

# An immediate crash, silent restart, or fatal JS render must fail the test.
first_pid=''
for ((second = 0; second < 45; second++)); do
  pid=$("$adb" -s "$serial" shell pidof "$package" | tr -d '\r' || true)
  [[ "$pid" =~ ^[0-9]+$ ]] || fail 'ANVIRA process exited after launch; inspect logcat.log.'
  [[ -z "$first_pid" || "$pid" == "$first_pid" ]] || fail 'ANVIRA process restarted during launch.'
  first_pid=$pid
  if has_launch_errors; then
    fail 'Native crash or React Native JavaScript error detected; inspect logcat.log.'
  fi
  sleep 1
done
[[ $("$adb" -s "$serial" shell pidof "$package" | tr -d '\r' || true) == "$first_pid" ]] ||
  fail 'ANVIRA exited or restarted at the end of the observation window.'
"$adb" -s "$serial" logcat -d -v threadtime -b main -b system -b crash \
  'ReactNativeJS:V' 'ReactNative:V' 'AndroidRuntime:V' 'libc:F' 'DEBUG:F' '*:S' \
  > "$work/logcat-check.log"
cat "$work/logcat-check.log" >> "$work/logcat.log"
if has_launch_errors; then
  fail 'Native crash or React Native JavaScript error detected at the end of launch.'
fi
"$adb" -s "$serial" shell dumpsys activity activities > "$work/activities.log"
grep -Eq "(mResumedActivity|topResumedActivity).*${package//./\\.}/(${package//./\\.})?\\.MainActivity" "$work/activities.log" ||
  fail 'ANVIRA MainActivity is not in the foreground after launch.'
printf 'ANVIRA stayed alive in the foreground for 45 seconds without native/JavaScript errors.\n'
