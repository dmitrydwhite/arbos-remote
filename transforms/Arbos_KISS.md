# Arbos KISS Protocol

As the name implies, the Arbos KISS Protocol is based heavily on the AX.25 KISS Protocol, and similar to SLIP as well.

## Control Bytes

| Hex Value | Decimal Value | Short Name | Long Name |
| :-: | :-: | :-: | --- |
| `0xC0` | 192 | `FEND` | Frame Start / End |
| `0xDB` | 219 | `FESC` | Frame Escape |
| `0xDC` | 220 | `TFEND` | Transposed Frame Start / End |
| `0xDD` | 221 | `TFESC` | Transposed Frame Escape |

Frames are bookended by `FEND` bytes. If the `FEND` or `FESC` codes appear in the data to be transferred, they need to be escaped. The `FEND` code is then sent as `FESC TFEND` and the `FESC` is then sent as `FESC TFESC`.

Multiple `FEND` bytes in a row do not indicate empty frames, and may be skipped over by the receiver of the data.

## Frame Structure

A properly formatted Arbos KISS frame is composed of `FEND` characters at the start and end, two Increment Bytes immediately after the first `FEND` followed by the properly-escaped data.

| Byte Index | 0 | 1-2 | 3...n | n + 1 |
| :-: | :-: | :-: | :-: | :-: |
| Data | `0xC0` | [Increment Bytes](#increment-bytes) | Escaped Data | `0xC0` |

## Increment Bytes

#### For most messages that do not exceed the frame size limit, the increment bytes will be `0x00 0x00`.

Unlike AX.25 KISS, Arbos KISS uses 2 control bytes called Increment Bytes immediately following the opening `FEND` character (and does not use the AX.25 KISS control byte). These Increment Bytes indicate whether the frame is a part of a larger message that spans multiple frames, and if so, what its position in that larger message is.

If the frame is not part of a larger message, the two Increment Bytes are simply: `0x00 0x00`.

Arbos imposes a limit of 65,503 data bytes in a single frame. This limit is set with the intent of allowing a single, properly-escaped Arbos frame to fit inside a UDP over IPV4 packet (though there is no requirement that those protocols be used to transport the data). This limit allows for Arbos KISS to add 4 control bytes (the start, stop, and 2 Increment Bytes) and still fit inside the UDP maximum of 65,535 along with the IPV4 and UDP headers.

If a single message, once escaped, contains more than the limit of 65,503 bytes, the Increment Bytes are used to spread the message across multiple frames and retain its comprehensibility.

The 2 Increment Bytes contain 3 values:
* Message ID from 1 - 1024 (can and should be reset between passes)
* Message segment (0 - 7)
* Total segments (2 - 8);

The values are encoded by bits within the 2 bytes as follows:

| Bits | `0 1 2 3 4 5 6 7 :: 0 1` | `2 3 4` | `5 6 7` |
| :-: | :-: | :-: | :-: |
| Value | Message ID | Current Index | Total Segments - 1 |

For example, imagine a message that after encoding is 246,871 bytes long.
```
246871 / 65503 = 3.768... or 4 packets needed.
```

Encoding both the current frame's index as well as the total number of frames for the message allows the receiver to receive frames out of order and still know when the complete message has been received.

We will assign it the Message ID of `100`, and its Total Segments value will be 4 - 1 = 3 (we always subtract 1 since there will never be an ID-identified packet with fewer than 2 packets).

Let's calculate each frame's Increment bytes:

##### Frame 0
```
Message ID          100 << 6 = 6400
Current frame index   0 << 3 =    0
Total segments value          +   3
                              -----
                               6403

Write 6403 to two bytes (BE): [ 0x19 0x03 ]
```
##### Frame 1
```
Message ID          100 << 6 = 6400
Current frame index   1 << 3 =    8
Total segments value          +   3
                              -----
                               6411

Write 6411 to two bytes (BE): [ 0x19 0x0b ]
```
##### Frame 2
```
Message ID          100 << 6 = 6400
Current frame index   2 << 3 =   16
Total segments value          +   3
                              -----
                               6419

Write 6419 to two bytes (BE): [ 0x19 0x13 ]
```
##### Frame 3
```
Message ID          100 << 6 = 6400
Current frame index   3 << 3 =   24
Total segments value          +   3
                              -----
                               6427

Write 6427 to two bytes (BE): [ 0x19 0x1b ]
```
