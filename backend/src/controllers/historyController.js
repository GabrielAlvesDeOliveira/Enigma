import * as historyService from "../services/historyService.js";
import { parseHistoryFilters } from "../utils/historyFilters.js";
import { parseId } from "../utils/parseId.js";

export async function mine(req, res) {
  const result = await historyService.listPlayerHistory(req.user, parseHistoryFilters(req.query));
  res.json(result);
}

export async function adminList(req, res) {
  const result = await historyService.listAdminHistory(req.user, parseHistoryFilters(req.query));
  res.json(result);
}

export async function adminDetail(req, res) {
  const id = parseId(req.params.id, "Sala não encontrada.");
  const result = await historyService.getAdminRoomDetail(id, req.user);
  res.json(result);
}