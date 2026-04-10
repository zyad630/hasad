import logging

logger = logging.getLogger(__name__)

def log(tenant, user, action, entity_type, entity_id, before=None, after=None, request=None, notes=None):
    """
    Core Audit Logging utility.
    """
    logger.info(f"AUDIT [{tenant}] {user} did {action} on {entity_type} {entity_id} - Notes: {notes}")
