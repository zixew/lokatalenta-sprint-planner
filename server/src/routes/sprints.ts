import { Router } from 'express';
import {
  AGENTS_BY_ID,
  isValidAgentId,
  isValidDivision,
  isValidSprintStatus,
  type DivisionId,
} from '../contracts/canonical.js';
import type { SprintService } from '../domain/sprintService.js';
import {
  ApiError,
  validateAssignItemBody,
  validateCapacityUpdateBody,
  validateCeremonyBody,
  validateCreateSprintBody,
  validateStoryPoints,
  validateUpdateSprintBody,
  validateUpdateSprintItemBody,
} from '../domain/validation.js';
import type { BacklogClient } from '../integrations/backlogClient.js';
import type { GatewayEmitter } from '../integrations/gatewayEmitter.js';

export function createSprintsRouter(deps: {
  sprintService: SprintService;
  backlogClient: BacklogClient;
  gatewayEmitter: GatewayEmitter;
}): Router {
  const { sprintService, backlogClient, gatewayEmitter } = deps;
  const router = Router();

  router.get('/', (req, res) => {
    const rawStatus = req.query.status;
    if (rawStatus !== undefined) {
      const statusStr = String(rawStatus);
      if (!isValidSprintStatus(statusStr)) {
        throw new ApiError(400, 'status query filter must be one of: planned, active, completed');
      }
      res.status(200).json({ sprints: sprintService.listSprints(statusStr) });
      return;
    }

    res.status(200).json({ sprints: sprintService.listSprints() });
  });

  router.post('/', async (req, res) => {
    const input = validateCreateSprintBody(req.body);
    const sprint = sprintService.createSprint(input);
    const action = sprint.status === 'active' ? 'sprint.started' : 'sprint.created';

    await gatewayEmitter.emit({
      action,
      divisionId: 'executive',
      agentId: 2,
      entityId: sprint.id,
      title:
        action === 'sprint.started'
          ? `Sprint Started: ${sprint.name}`
          : `Sprint Created: ${sprint.name}`,
      summary: `${sprint.id} (${sprint.startDate} to ${sprint.endDate}) ${
        action === 'sprint.started' ? 'activated' : 'planned'
      }.`,
      targetZone: 'boardroom',
      targetFloor: 2,
      severity: action === 'sprint.started' ? 'success' : 'info',
      metadata: {
        sprintId: sprint.id,
        status: sprint.status,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      },
    });

    res.status(201).json({ sprint });
  });

  router.get('/:id', (req, res) => {
    const id = String(req.params.id);
    const sprint = sprintService.getSprint(id);
    res.status(200).json({ sprint });
  });

  router.patch('/:id', async (req, res) => {
    const id = String(req.params.id);
    const input = validateUpdateSprintBody(req.body);
    const { previousStatus, sprint } = sprintService.updateSprint(id, input);

    let action: 'sprint.started' | 'sprint.completed' | 'sprint.updated' = 'sprint.updated';
    let severity: 'info' | 'success' = 'info';
    if (previousStatus !== 'active' && sprint.status === 'active') {
      action = 'sprint.started';
      severity = 'success';
    } else if (previousStatus !== 'completed' && sprint.status === 'completed') {
      action = 'sprint.completed';
      severity = 'success';
    }

    await gatewayEmitter.emit({
      action,
      divisionId: 'executive',
      agentId: action === 'sprint.completed' ? 0 : 2,
      entityId: sprint.id,
      title:
        action === 'sprint.started'
          ? `Sprint Started: ${sprint.name}`
          : action === 'sprint.completed'
            ? `Sprint Completed: ${sprint.name}`
            : `Sprint Updated: ${sprint.name}`,
      summary: `${sprint.id} status=${sprint.status}, committed=${sprint.metrics.committedPoints} SP, completed=${sprint.metrics.completedPoints} SP.`,
      targetZone: 'boardroom',
      targetFloor: 2,
      severity,
      metadata: {
        sprintId: sprint.id,
        previousStatus,
        status: sprint.status,
        committedPoints: sprint.metrics.committedPoints,
        completedPoints: sprint.metrics.completedPoints,
      },
    });

    res.status(200).json({ sprint });
  });

  router.get('/:id/capacity', (req, res) => {
    const id = String(req.params.id);
    const sprint = sprintService.getSprint(id);
    res.status(200).json({
      sprintId: sprint.id,
      divisionCapacities: sprint.divisionCapacities,
      agentCapacities: sprint.agentCapacities,
    });
  });

  router.put('/:id/capacity', async (req, res) => {
    const id = String(req.params.id);
    const input = validateCapacityUpdateBody(req.body);
    const sprint = sprintService.updateCapacities(id, input);

    await gatewayEmitter.emit({
      action: 'sprint.capacity_updated',
      divisionId: 'executive',
      agentId: 2,
      entityId: sprint.id,
      title: `Capacity Updated: ${sprint.name}`,
      summary: `Total division capacity set to ${sprint.metrics.totalCapacityPoints} SP for ${sprint.id}.`,
      targetZone: 'boardroom',
      targetFloor: 2,
      severity: 'info',
      metadata: {
        sprintId: sprint.id,
        totalCapacityPoints: sprint.metrics.totalCapacityPoints,
        totalAgentCapacityPoints: sprint.metrics.totalAgentCapacityPoints,
      },
    });

    res.status(200).json({ sprint });
  });

  router.post('/:id/assign', async (req, res) => {
    const id = String(req.params.id);
    // Validate sprint exists before calling Backlog API
    sprintService.getSprint(id);

    const input = validateAssignItemBody(req.body);
    const { item: remoteItem, backlogSync } = await backlogClient.patchItem(input.itemId, {
      sprintId: id,
      status: 'in_sprint',
    });

    const remoteTitle =
      remoteItem && typeof remoteItem.title === 'string' && remoteItem.title.trim().length > 0
        ? remoteItem.title.trim().slice(0, 240)
        : undefined;
    const remoteStoryPoints =
      remoteItem &&
      typeof remoteItem.storyPoints === 'number' &&
      Number.isFinite(remoteItem.storyPoints) &&
      remoteItem.storyPoints >= 0
        ? validateStoryPoints(remoteItem.storyPoints)
        : undefined;
    const remoteAgentId =
      remoteItem && isValidAgentId(remoteItem.ownerAgentId)
        ? remoteItem.ownerAgentId
        : undefined;
    const remoteDivision =
      remoteItem && isValidDivision(remoteItem.ownerDivision)
        ? remoteItem.ownerDivision
        : undefined;

    const ownerAgentId =
      input.ownerAgentId !== undefined
        ? input.ownerAgentId
        : remoteAgentId !== undefined
          ? remoteAgentId
          : null;

    const ownerDivision: DivisionId =
      input.ownerDivision ??
      remoteDivision ??
      (typeof ownerAgentId === 'number' ? AGENTS_BY_ID[ownerAgentId]?.divisionId : undefined) ??
      'engineering';

    const title = input.title ?? remoteTitle ?? input.itemId;
    const storyPoints = input.storyPoints ?? remoteStoryPoints ?? 0;
    const status = input.status ?? 'in_sprint';

    const { sprint, assignment } = sprintService.assignItem(id, {
      itemId: input.itemId,
      title,
      storyPoints,
      ownerDivision,
      ownerAgentId,
      status,
      backlogSynced: backlogSync.synced,
    });

    await gatewayEmitter.emit({
      action: 'sprint.item_assigned',
      divisionId: assignment.ownerDivision,
      agentId:
        typeof assignment.ownerAgentId === 'number' ? assignment.ownerAgentId : undefined,
      entityId: assignment.itemId,
      title: `Assigned ${assignment.itemId} to ${sprint.id}`,
      summary: `${assignment.title} (${assignment.storyPoints} SP, ${assignment.ownerDivision}) committed to ${sprint.id}.`,
      targetZone: assignment.ownerDivision === 'lounge' ? 'lounge' : 'workspace',
      severity: 'info',
      metadata: {
        sprintId: sprint.id,
        itemId: assignment.itemId,
        storyPoints: assignment.storyPoints,
        ownerDivision: assignment.ownerDivision,
        ownerAgentId: assignment.ownerAgentId,
        backlogSynced: backlogSync.synced,
      },
    });

    res.status(200).json({
      sprint,
      assignment,
      backlogSync,
    });
  });

  router.patch('/:id/items/:itemId', async (req, res) => {
    const id = String(req.params.id);
    const itemId = String(req.params.itemId);
    const input = validateUpdateSprintItemBody(req.body);

    const updated = sprintService.updateSprintItem(id, itemId, input);
    let assignment = updated.assignment;
    let sprint = updated.sprint;
    let backlogSync: { synced: boolean; statusCode?: number; warning?: string } = {
      synced: assignment.backlogSynced,
    };

    if (input.status !== undefined) {
      const targetRemoteStatus = assignment.status === 'done' ? 'done' : 'in_sprint';
      const syncResult = await backlogClient.patchItem(itemId, {
        sprintId: id,
        status: targetRemoteStatus,
      });
      backlogSync = syncResult.backlogSync;
      const persisted = sprintService.updateSprintItem(id, itemId, {
        backlogSynced: backlogSync.synced,
      });
      sprint = persisted.sprint;
      assignment = persisted.assignment;
    }

    await gatewayEmitter.emit({
      action: 'sprint.item_updated',
      divisionId: assignment.ownerDivision,
      agentId:
        typeof assignment.ownerAgentId === 'number' ? assignment.ownerAgentId : undefined,
      entityId: assignment.itemId,
      title: `Updated ${assignment.itemId} (${assignment.status})`,
      summary: `${assignment.title} in ${sprint.id} is now ${assignment.status} (${assignment.storyPoints} SP).`,
      targetZone: assignment.ownerDivision === 'lounge' ? 'lounge' : 'workspace',
      severity: assignment.status === 'done' ? 'success' : 'info',
      metadata: {
        sprintId: sprint.id,
        itemId: assignment.itemId,
        status: assignment.status,
        storyPoints: assignment.storyPoints,
      },
    });

    res.status(200).json({
      sprint,
      assignment,
      backlogSync,
    });
  });

  router.delete('/:id/items/:itemId', async (req, res) => {
    const id = String(req.params.id);
    const itemId = String(req.params.itemId);
    const { sprint, removedItem } = sprintService.removeSprintItem(id, itemId);

    const { backlogSync } = await backlogClient.patchItem(itemId, {
      sprintId: null,
      status: 'ready',
    });

    await gatewayEmitter.emit({
      action: 'sprint.updated',
      divisionId: removedItem.ownerDivision,
      agentId:
        typeof removedItem.ownerAgentId === 'number' ? removedItem.ownerAgentId : undefined,
      entityId: removedItem.itemId,
      title: `Unassigned ${removedItem.itemId} from ${sprint.id}`,
      summary: `${removedItem.title} removed from ${sprint.id} scope.`,
      targetZone: 'boardroom',
      targetFloor: 2,
      severity: 'info',
      metadata: {
        sprintId: sprint.id,
        removedItemId: removedItem.itemId,
      },
    });

    res.status(200).json({
      sprint,
      removedItemId: itemId,
      backlogSync,
    });
  });

  router.get('/:id/ceremonies', (req, res) => {
    const id = String(req.params.id);
    const ceremonies = sprintService.listCeremonies(id);
    res.status(200).json({ sprintId: id, ceremonies });
  });

  router.post('/:id/ceremonies', async (req, res) => {
    const id = String(req.params.id);
    const input = validateCeremonyBody(req.body);
    const { ceremony, sprint } = sprintService.addCeremony(id, input);
    const facilitator = AGENTS_BY_ID[ceremony.facilitatorAgentId];

    await gatewayEmitter.emit({
      action: 'sprint.ceremony_recorded',
      divisionId: facilitator?.divisionId ?? 'executive',
      agentId: ceremony.facilitatorAgentId,
      entityId: sprint.id,
      title: `${ceremony.type.toUpperCase()} Ceremony Recorded (${sprint.id})`,
      summary: ceremony.notes.slice(0, 500),
      targetZone: 'boardroom',
      targetFloor: 2,
      severity: 'info',
      metadata: {
        sprintId: sprint.id,
        ceremonyId: ceremony.id,
        ceremonyType: ceremony.type,
        facilitatorAgentId: ceremony.facilitatorAgentId,
        actionItemCount: ceremony.actionItems.length,
      },
    });

    res.status(201).json({ ceremony, sprint });
  });

  router.get('/:id/summary', (req, res) => {
    const id = String(req.params.id);
    const summary = sprintService.getSummary(id);
    res.status(200).json(summary);
  });

  router.get('/:id/backlog-candidates', async (req, res) => {
    const id = String(req.params.id);
    const sprint = sprintService.getSprint(id);
    const divisionFilter =
      req.query.division !== undefined ? String(req.query.division) : undefined;
    if (divisionFilter !== undefined && !isValidDivision(divisionFilter)) {
      throw new ApiError(400, `Invalid division filter "${divisionFilter}"`);
    }
    const includeAll = String(req.query.includeAll ?? '').toLowerCase() === 'true';

    const { items, backlogSync } = await backlogClient.fetchItems(
      divisionFilter ? { division: divisionFilter } : undefined,
    );

    const assignedIds = new Set(sprint.items.map((item) => item.itemId));
    const candidates = items.filter((item) => {
      if (assignedIds.has(item.id)) {
        return false;
      }
      if (includeAll) {
        return true;
      }
      return !item.status || item.status === 'groomed' || item.status === 'ready';
    });

    res.status(200).json({
      sprintId: id,
      candidates,
      backlogSync,
    });
  });

  return router;
}
