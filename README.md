# Concourse Autotree Webhooks

This tool will help you automatically manage webhooks for Concourse repositories in Bitbucket by generating Terraform configurations.

Currently this tool only works for Bitbucket, but other support may be added and PRs are welcome.

<!-- MDTOC maxdepth:2 firsth1:0 numbering:0 flatten:0 bullets:1 updateOnSave:1 -->

- [Prerequisites](#Prerequisites)
- [Setup](#Setup)
   - [Terraform Provider](#Terraform-Provider)
   - [Credentials](#Credentials)
   - [Concourse Resources](#Concourse-Resources)
- [Generate Terraform Files](#Generate-Terraform-Files)
   - [Flags](#Flags)
- [Import Resources](#Import-Resources)
- [Run Terraform](#Run-Terraform)
- [Known Issues / TODO](#Known-Issues-TODO)
- [Development](#Development)

<!-- /MDTOC -->

## Changelog

##### 0.2.0
- Generated hook resources now include the team name to prevent collisions of same names on different teams. To migrate from the previous version, do the following.
  - `terraform state pull > old.state`
  - Replace all `bitbucket_hook` resource names with one prefixed with "$TEAMNAME_". If you have only one team, here's a shortcut: `sed -i.bak -e "s/bitbucket_hook\./bitbucket_hook.$TEAM_NAME/g" old.state`
  - `terraform state push old.state`
  - Regenerate your TF files with the new version of this tool.

## Prerequisites

* Terraform
* [terraform-provider-bitbucket](https://github.com/terraform-providers/terraform-provider-bitbucket) from master branch, until they release `skip_cert_verification`. (This can be skipped if you don't need skip_cert_verification)
* Bitbucket username and password
* Concourse pipelines repository, formatted according to the [`autotree`](https://github.com/tprobinson/concourse-autotree-pipelines) layout.

## Setup
Install this tool globally:

```sh
npm install -g concourse-autotree-hooks
yarn global add concourse-autotree-hooks
```

This module gives the command `autotree-hooks-generate`. Be sure to create a folder for any generated files and always run commands in that folder.

### Terraform Backends

Create a file called `backend.json`. This file should contain data about the Terraform backend you intend to use, in JSON format. An example of an S3 backend:
```json
{
	"s3": {
		"bucket": "my-terraform-state",
		"dynamodb_table": "my-terraform-state-locking",
		"acl": "private",
		"key": "terraform/hooks.tfstate",
		"region": "us-west-2",
		"encrypt": true
	}
}
```

Any backend supported by Terraform is supported, and any configuration for those backends is supported as well -- this file is just a mapping to keep your personal Terraform configuration separate from the automatically managed Terraform files.

### Credentials

Put your credentials into a file called `terraform.tfvars` like this:
```ini
username = "whatever@someplace.com"
password = "secret"
```

It is recommended that you do not commit the `terraform.tfvars` file to a repository as it contains credentials. You can use the .gitignore in this module as a base if you want.

### Concourse Resources

Clone the Concourse pipelines repository to your local system, somewhere that's reachable by the generate.js script. It doesn't have to be in the same directory, as the generator will resolve paths like `~/git/something/../whatever` automatically.

```sh
git clone whatever.git
```

**Please note** that you must have a [`webhook_token`](https://concourse-ci.org/resources.html#resource-webhook-token) configured on any resources that you want webhooks for. This script will not notice any resources that do not have a webhook token. It is recommended that you use a freshly generated password for this value. Special characters are supported.

# Usage

## Generate Terraform Files

Run `autotree-hooks-generate` to create all the terraform configurations. Flags for the script are below.

```sh
autotree-hooks-generate --concourse-root ~/concourse --concourse-webhook-url https://xxx.xxx.xxx.xxx
```

### Flags
| Name                       | Default Value | Description                                                                            |
| -------------------------- | ------------- | -------------------------------------------------------------------------------------- |
| concourse-root             | N/A, required | A file path to the Concourse Pipelines repository.                                     |
| concourse-webhook-url      | N/A, required | The protocol and hostname where Bitbucket can reach your Concourse instance.           |
| noop                       | false         | Specify --noop to see what the generator would do, rather than actually do it.         |
| manage-repositories        | false         | Create a resource to manage each repository as well as webhooks. Not recommended.      |
| clean                      | false         | Do nothing but clean up files. Can be combined with --noop                             |
| filter-repo-owner          | N/A           | If specified, use only repositories that begin with this string.                       |
| skip-cert-verification     | false         | If specified, webhooks will ignore SSL errors.                                         |
| bitbucket-provider-version | N/A           | If specified, the generated Terraform Bitbucket provider will use this version string. |


## Import Resources

If you've run the script with the `--manage-repositories` flag, it is likely that you have a lot of existing repositories that you do not want to re-create for Terraform. The generator script creates `importHelper.sh` to do this for you:

```sh
source importHelper.sh
```

Terraform should successfully import all your existing repositories.


## Run Terraform
Now you can run Terraform normally. If this is a first run, you should initialize Terraform:

```sh
terraform init
```

When ready, run Terraform:

```sh
terraform apply
```

If you see any actions being taken on your repositories (any changes to a `bitbucket_repository` resource), **CANCEL THE PLAN** and file an issue with the output. This plan is intended to make no changes to your repositories themselves, only the hooks.


## Known Issues / TODO

* Support for `*.auto.tfvars` files
* Support for source control other than Bitbucket


## Development

Please use a style consistent with the rest of the project. An ESLint file has been provided, and Yarn will install plugins for it.

Please do not check in any Terraform(`.tf`) or variables(`.tfvars`) files.
