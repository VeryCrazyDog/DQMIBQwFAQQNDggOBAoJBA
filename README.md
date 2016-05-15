# Private Project

This is a private project.

## Installation

1. Install required module using the command `npm install`
2. Set the configuration by either:
	* Either editing `config/default.js`
	* Create a new host-based configuration file having the same name as the lower case of the hostname. For example, if the hostname is `MyWindowsPC`, the host-based configuration file should be at `config/mywindowspc.js`. You may find an example at `config/localhost.js`.

## Usage

```
node index.js
```

## Tested Environment

* Windows 7 Ultimate 64-bit
* Node.js 4.2.1 64-bit
* beanstalkd 1.9
* mongodb 3.0.10
