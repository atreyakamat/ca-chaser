import "server-only";
import type { Db } from "../db";

export type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  channel: "whatsapp" | "email";
  whatsappOptIn: boolean;
  active: boolean;
  documents: number;
};

const COLUMNS = `c.id, c.name, c.phone, c.email, c.gstin, c.channel, c.whatsapp_opt_in as "whatsappOptIn", c.active`;

export function listClients(db: Db, firmId: string): Promise<ClientRow[]> {
  return db.query<ClientRow>(
    `select ${COLUMNS},
            (select count(*) from client_requirements r join document_types d on d.id = r.document_type_id
              where r.client_id = c.id and d.active) as documents
       from clients c where c.firm_id = $1
      order by c.active desc, lower(c.name)`,
    [firmId],
  );
}

export async function getClient(db: Db, firmId: string, id: string): Promise<(ClientRow & { requirements: string[] }) | null> {
  return db.one<ClientRow & { requirements: string[] }>(
    `select ${COLUMNS}, 0 as documents,
            coalesce((select array_agg(r.document_type_id) from client_requirements r where r.client_id = c.id), '{}') as requirements
       from clients c where c.id = $1 and c.firm_id = $2`,
    [id, firmId],
  );
}

export type DocumentType = { id: string; name: string; active: boolean; clients: number };

export function listDocumentTypes(db: Db, firmId: string): Promise<DocumentType[]> {
  return db.query<DocumentType>(
    `select d.id, d.name, d.active,
            (select count(*) from client_requirements r join clients c on c.id = r.client_id
              where r.document_type_id = d.id and c.active) as clients
       from document_types d where d.firm_id = $1
      order by d.active desc, d.sort_order, d.name`,
    [firmId],
  );
}
