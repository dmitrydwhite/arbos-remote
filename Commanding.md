# Interacting with Arbos

Arbos telecommand messages start and end as JavaScript objects serialized to and from JSON.

Every telecommand object should have at its root level a `tc` property indicating what type of telecommand it is.

There are 5 Modes for Arbos during a pass:
* WOD
* DATA
* STATUS
* UPDATE
* RESPONSIVE

### `WOD` Mode
This mode will automatically downlink as much Whole Orbit Data telemetry as specified in the `data` parameter.

### `DATA` Mode
This mode will automatically downlink the files indicated at the paths specified in the `data` parameter.

### `STATUS` Mode
This mode will automatically downlink live telemetry during the pass. The telemetry may be constrained by  values in the `data` parameter.

### `UPDATE` Mode
In this mode the remote will be ready to receive uplink files.

### `RESPONSIVE` Mode
In this mode, the satellite will be ready to receive and respond to various live commands from the ground.

## Let's do a pass

Start by setting the remote to WOD mode:
```
{
    "tc": "set_mode",
    "mode": "WOD",
    "data": 0,
}
```

The remote system will downlink all of its Whole Orbit Data (since `data` was set to `0`). When that downlink has finished, it will send us a remote response to inform us:

```
{
    "remote": "success",
    "task": "mode",
    "desc": "WOD",
}
```

Now we have the remote system's historical telemetry. We believe it also captured one or more data products since we last communicated with it, so let's request that it send us those files. On the ground we know that data product files are kept in the folder `/sys/data/downlink`.

```
{
    "tc": "set_mode",
    "mode": "DATA",
    "data" ["/sys/data/downlink/*"],
}
```

The remote system looks and finds two files in `/sys/data/downlink`. It will create two file channels (`101` and `102`), and initiate a file transfer for both files using the Arbos File Protocol by sending the following messages:

```
[101, 2, "0eqJafESZZ61E40lXENKWQ", 1, "/sys/data/downlink/riga.bin"]
```

```
[102, 2, "kA6Fc66lJoxTLitTf6bNaw", 3, "/sys/data/downlink/betel.bin"]
```

The Arbos Ground file service will automatically prepare to receive the two files and respond with the following messages, indicating that the ground needs the file chunks:

```
[101, 7, "0eqJafESZZ61E40lXENKWQ", 0, 1]
```

```
[102, 7, "kA6Fc66lJoxTLitTf6bNaw", 0, 3]
```

The remote system will then transfer the files in chunks:

```
[102, 5, "kA6Fc66lJoxTLitTf6bNaw", 0, "8b60f8cc251c97e6b2331ef15244936c4ab4a975cafef105cd0b3823a8d7fba8..." ]

[101, 5, "0eqJafESZZ61E40lXENKWQ", 0, "c265a0003d9fa221be8dc6942be711813dff363df7e4b9c3cd56775dc2da58d6c5f920e0b49d1117d9649ea8fe27346121e6666e39f41d7633"]

[102, 5, "kA6Fc66lJoxTLitTf6bNaw", 1, "3c87427341df645feb2f32541201ef36cd8b61b4c7a427e7e355ba23520a27ff..."]

[102, 5, "kA6Fc66lJoxTLitTf6bNaw", 2, "21a8657a9247a93301372cdff34044ff4d923c99cd5af796f2a139f48aeb66af..."]

[101, 4, "0eqJafESZZ61E40lXENKWQ"]

[102, 4, "kA6Fc66lJoxTLitTf6bNaw"]
```

The Arbos Ground file service successfully received all the file chunks for both files, so will send its acknowledgement of that in two file messages:

```
[101, 0, "0eqJafESZZ61E40lXENKWQ"]

[102, 0, "kA6Fc66lJoxTLitTf6bNaw"]
```

When the remote system receives both of those ACK messages from the ground file service, it will also respond with a success message for the UPDATE mode:

```
{
    "remote": "success",
    "task": "mode",
    "desc": "DATA",
    "data": ["/sys/data/downlink/*"],
    "count": 2,
}
```

---


We send:

```js
{
    tc: "STATUS",
    window: 5.25, //
}
```

Most operations can probably be done with the Standard Library of telecommands. Let's take a look at them now.

## The `ip` (Initialize Pass) telecommand

### TypeScript description
```ts
enum PassType {
    DATA,
    UPDATE,
    DATA_CONTINUED,
    UPDATE_CONTINUED,
    STATUS,
    RESPONSIVE,
}

type pathToDataFileForDownlink = string;

interface DataPassIPTelecommand {
    ip: 'tc';
    priority: PassType.DATA,
    fallback: PassType[],
    data: pathToDataFileForDownlink[],
}

