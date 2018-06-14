# Terraform Bitbucket

This is not a typical Terraform repository. This repository is intended to link Concourse pipelines with Bitbucket configurations to automatically manage webhooks based on Pipeline definitions.

<!-- MDTOC maxdepth:2 firsth1:1 numbering:0 flatten:0 bullets:1 updateOnSave:1 -->

- [Terraform Bitbucket](#Terraform-Bitbucket)   
- [Prerequisites](#Prerequisites)   
   - [Setup](#Setup)   
- [Usage](#Usage)   
   - [Generate Terraform Files](#Generate-Terraform-Files)   
   - [Import Resources (First Run)](#Import-Resources-First-Run)   
   - [Run Terraform](#Run-Terraform)   
   - [Known Issues / TODO](#Known-Issues-TODO)   
   - [Development](#Development)   

<!-- /MDTOC -->

# Prerequisites

* Node
* Yarn (optional, substitute `yarn` calls with `npm`)
* Terraform
* [terraform-provider-bitbucket](https://github.com/terraform-providers/terraform-provider-bitbucket) from master branch, until they release `skip_cert_verification`. See some other Terraform plan on how to install custom providers.
* Bitbucket username and password
* Concourse pipelines repository, formatted according to the `hooks` layout.

## Setup

### Concourse Resources

Clone the Concourse pipelines repository to your local system, somewhere that's reachable by the generate.js script. It doesn't have to be in the same directory, as the generator will resolve paths like `~/git/something/../whatever` automatically.

```sh
git clone whatever.git
```

### Bitbucket Credentials

Put your Bitbucket credentials into a file called `terraform.tfvars` like this:
```ini
username = "whatever@someplace.com"
password = "secret"
```

This file is read both by the JS generator, and Terraform.

### JS dependencies

Run Yarn (or NPM) in this repository to install everything needed.

```sh
yarn
```


# Usage

## Generate Terraform Files

Run `generate.js` to create all the terraform configurations. Flags for the script are below.

```sh
node generate.js --concourse-root ~/concourse --concourse-webhook-url https://xxx.xxx.xxx.xxx
```

### Flags
| Name                  | Default Value | Description                                                                  |
| --------------------- | ------------- | ---------------------------------------------------------------------------- |
| concourse-root        | N/A           | A file path to the Concourse Pipelines repository.                           |
| concourse-webhook-url | N/A           | The protocol and hostname where Bitbucket can reach your Concourse instance. |
| noop                  | false         | Specify --noop to see what the generator would create, rather than actually do it.                                                                             |


## Import Resources (First Run)

If this is your first time running the plan, it is likely that you have a lot of existing repositories that you do not want to re-create for Terraform. The generator script creates `importHelper.sh` to do this for you:

```sh
source importHelper.sh
```

Terraform should successfully import all your existing repositories.


## Run Terraform

```sh
terraform apply
```

If you see any actions being taken on your repositories (any changes to a `bitbucket_repository` resource), **CANCEL THE PLAN** and file an issue with this repository with the output. This plan is intended to make no changes to your repositories themselves, only the hooks.


## Known Issues / TODO


## Development

Please use a style consistent with the rest of the project. An ESLint file has been provided, and Yarn will install plugins for it.

Please do not check in any Terraform(`.tf`) or variables(`.tfvars`) files.
