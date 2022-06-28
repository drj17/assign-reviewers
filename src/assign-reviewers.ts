import * as core from '@actions/core'

import { Config } from './get-config'
import { Octokit } from '@octokit/rest'

export interface Pull {
  user: {
    login: string | null
  }
  number: number
  draft: boolean
}
interface Env {
  repository: string
  ref: string
}

const selectRandomReviewers = (
  usernames: string[],
  count: number
): string[] => {
  const picks: string[] = []

  while (picks.length < count) {
    const random = Math.floor(Math.random() * usernames.length)
    const pick = usernames.splice(random, 1)[0]

    if (!picks.includes(pick)) picks.push(pick)
  }

  return picks
}

const setReviewers = async (
  octokit: Octokit,
  config: Config,
  env: Env,
  pr: Pull,
  reviewers: string[]
): Promise<object> => {
  const { owner, repo } = getOwnerAndRepo(env)
  const { data } = await octokit.pulls.requestReviewers({
    owner,
    repo,
    pull_number: pr.number,
    reviewers
  })
  return data
}

const selectReviewers = async (
  octokit: Octokit,
  config: Config,
  env: Env,
  pr: Pull
): Promise<string[]> => {
  let selectedReviewers: string[] = []
  try {
    const { owner } = getOwnerAndRepo(env)
    for (const group of config.groups) {
      const { reviewerCount = 1, usernames = [], teams = [] } = group
      const allUsernames = usernames?.slice() ?? []

      const response = await Promise.all(
        teams.map(async team => {
          return octokit.teams.listMembersInOrg({
            org: owner,
            team_slug: team
          })
        })
      )

      for (const members of response) {
        for (const member of members.data) {
          if (member.login !== pr.user.login) {
            allUsernames.push(member.login)
          }
        }
      }

      const availableUsers = allUsernames.filter(
        name => !selectedReviewers.includes(name)
      )

      if (availableUsers.length < reviewerCount) {
        throw new Error(`Not enough reviewers for group ${group.name}`)
      }

      selectedReviewers = selectedReviewers.concat(
        selectRandomReviewers(availableUsers, reviewerCount)
      )

      core.setOutput(
        `${group.name}-reviewers`,
        selectedReviewers.map(r => `@${r}`).join(',')
      )
    }
  } catch (error) {
    if (error instanceof Error) {
      core.error(error)
      core.setFailed(error.message)
    }
  }
  return selectedReviewers
}

const getOwnerAndRepo = (env: Env): { owner: string; repo: string } => {
  const [owner, repo] = env.repository.split('/')
  return { owner, repo }
}

const getPR = async (
  octokit: Octokit,
  config: Config,
  env: Env
): Promise<Pull | undefined> => {
  try {
    const { data } = await octokit.pulls.list({ ...getOwnerAndRepo(env) })
    const pr = data.find(pullRequest => pullRequest.head.ref === env.ref)

    if (!pr) {
      throw new Error(`PR matching ref not found: ${env.ref}`)
    } else {
      return pr as Pull
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

export const assignReviewers = async (
  octokit: Octokit,
  config: Config,
  env = {
    repository: process.env.GITHUB_REPOSITORY || '',
    ref: process.env.GITHUB_HEAD_REF || ''
  }
): Promise<void> => {
  core.startGroup(`Assigning reviewers for ${env.repository}`)
  const pr = await getPR(octokit, config, env)
  core.startGroup(`PR: ${JSON.stringify(pr)}`)

  if (!pr || pr.draft) return

  const reviewers = await selectReviewers(octokit, config, env, pr)
  core.startGroup(`Reviewers: ${JSON.stringify(reviewers)}`)
  setReviewers(octokit, config, env, pr, reviewers)
}
