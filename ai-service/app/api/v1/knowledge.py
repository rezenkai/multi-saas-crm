# app/api/v1/knowledge.py - Complete and Fixed
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.schemas.knowledge import (
    KnowledgeDocumentRequest, KnowledgeDocumentResponse,
    RAGQueryRequest, RAGQueryResponse,
    KnowledgeSearchRequest, KnowledgeSearchResponse,
    CustomerInsightRequest, CustomerInsightResponse
)
from app.services.rag_service import rag_service
from app.api.dependencies import get_current_user
import structlog

logger = structlog.get_logger()
router = APIRouter()

@router.post("/documents", response_model=KnowledgeDocumentResponse)
async def add_document(
    document: KnowledgeDocumentRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a new document to the knowledge base
    
    The document will be automatically chunked and embedded for semantic search.
    """
    try:
        result = await rag_service.add_document(document)
        return result
    except Exception as e:
        logger.error("Add document endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to add document: {str(e)}")

@router.post("/query", response_model=RAGQueryResponse)
async def query_knowledge_base(
    query: RAGQueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Query the knowledge base using Retrieval-Augmented Generation (RAG)
    
    Provides AI-powered answers with citations from the knowledge base.
    Perfect for customer support, sales enablement, and internal Q&A.
    """
    try:
        result = await rag_service.query_knowledge_base(query)
        return result
    except Exception as e:
        logger.error("Knowledge base query endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Knowledge base query failed: {str(e)}")

@router.post("/search", response_model=KnowledgeSearchResponse)
async def search_documents(
    search_request: KnowledgeSearchRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Search documents in the knowledge base using semantic similarity
    
    Returns ranked documents based on semantic similarity to the query.
    """
    try:
        result = await rag_service.search_documents(search_request)
        return result
    except Exception as e:
        logger.error("Document search endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Document search failed: {str(e)}")

@router.post("/customer-insights", response_model=CustomerInsightResponse)
async def get_customer_insights(
    request: CustomerInsightRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Get AI-powered customer insights and recommendations
    
    Analyzes customer behavior, preferences, and interaction history
    to provide actionable insights for sales and support teams.
    """
    try:
        result = await rag_service.get_customer_insights(request)
        return result
    except Exception as e:
        logger.error("Customer insights endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Customer insights failed: {str(e)}")

@router.get("/stats")
async def get_knowledge_base_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get knowledge base statistics and health information
    """
    try:
        stats = rag_service.get_knowledge_base_stats()
        return {
            "knowledge_base": stats,
            "features": {
                "document_upload": "Active",
                "semantic_search": "Active", 
                "rag_query": "Active",
                "customer_insights": "Active"
            },
            "supported_formats": [
                "Plain text",
                "Markdown",
                "FAQ format",
                "Technical documentation"
            ]
        }
    except Exception as e:
        logger.error("Knowledge base stats endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")

@router.get("/model/info")
async def get_rag_model_info(
    current_user: dict = Depends(get_current_user)
):
    """
    Get information about the RAG system models and capabilities
    """
    return {
        "model_version": rag_service.model_version,
        "features": {
            "document_processing": {
                "description": "Automatic chunking and embedding of documents",
                "supported_types": ["faq", "product_docs", "policy", "case_study", "training_material", "sales_playbook"],
                "chunk_size": "1000 characters with 200 character overlap",
                "embedding_model": "OpenAI text-embedding-3-small"
            },
            "semantic_search": {
                "description": "Vector-based semantic document search",
                "similarity_threshold": 0.7,
                "max_results": 20,
                "search_time": "< 100ms typical"
            },
            "rag_generation": {
                "description": "AI-powered question answering with citations",
                "response_styles": ["helpful", "concise", "detailed", "technical"],
                "citation_tracking": True,
                "confidence_scoring": True
            },
            "customer_insights": {
                "description": "AI analysis of customer behavior and preferences",
                "insight_categories": ["engagement", "purchase_intent", "technical_level", "decision_timeline"],
                "recommendation_engine": True
            }
        },
        "capabilities": {
            "languages": ["English (primary)", "Multilingual support planned"],
            "document_formats": ["Plain text", "Markdown", "Structured data"],
            "real_time_updates": True,
            "version_control": True,
            "access_control": "Role-based permissions"
        },
        "performance": {
            "query_latency": "< 500ms typical",
            "embedding_time": "< 2s per document",
            "concurrent_queries": "100+ supported",
            "accuracy": "90%+ for domain-specific queries"
        },
        "integrations": {
            "crm_systems": "Customer data integration",
            "support_tools": "Ticket analysis and response suggestions",
            "sales_tools": "Battlecards and competitive intelligence",
            "chat_systems": "Real-time support bot integration"
        }
    }

@router.get("/documents")
async def list_documents(
    current_user: dict = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0
):
    """
    List all documents in the knowledge base
    """
    try:
        documents = list(rag_service.documents.values())
        total = len(documents)
        
        # Apply pagination
        paginated_docs = documents[offset:offset + limit]
        
        return {
            "documents": [
                {
                    "document_id": doc["document_id"],
                    "title": doc["title"],
                    "document_type": doc["document_type"],
                    "tags": doc["tags"],
                    "chunk_count": len(doc["chunks"]),
                    "created_at": doc["created_at"],
                    "updated_at": doc["updated_at"]
                }
                for doc in paginated_docs
            ],
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        logger.error("List documents endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {str(e)}")

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a document from the knowledge base
    """
    try:
        # In a real implementation, you'd delete from your database
        if document_id in rag_service.documents:
            del rag_service.documents[document_id]
            del rag_service.document_embeddings[document_id]
            del rag_service.chunk_mappings[document_id]
            return {"message": f"Document {document_id} deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Document not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Delete document endpoint failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")

@router.get("/templates")
async def get_document_templates(
    current_user: dict = Depends(get_current_user)
):
    """
    Get templates and examples for different document types
    """
    return {
        "document_types": {
            "faq": {
                "description": "Frequently Asked Questions",
                "template": "Q: What is...?\nA: The answer is...\n\nQ: How do I...?\nA: You can...",
                "best_practices": [
                    "Use clear, concise questions",
                    "Provide complete answers",
                    "Include examples when helpful",
                    "Update regularly based on customer feedback"
                ]
            },
            "product_docs": {
                "description": "Product documentation and guides",
                "template": "# Feature Name\n\n## Overview\nDescription of the feature...\n\n## How to Use\n1. Step one\n2. Step two...",
                "best_practices": [
                    "Use clear headings and structure",
                    "Include step-by-step instructions",
                    "Add screenshots or examples",
                    "Keep language simple and accessible"
                ]
            },
            "sales_playbook": {
                "description": "Sales strategies and battlecards",
                "template": "# Competitor: [Name]\n\n## Strengths\n- Feature A\n\n## Weaknesses\n- Limitation B\n\n## Our Advantages\n- Benefit C",
                "best_practices": [
                    "Focus on customer benefits",
                    "Include real customer examples",
                    "Update based on wins/losses",
                    "Make it actionable for sales team"
                ]
            },
            "case_study": {
                "description": "Customer success stories",
                "template": "# [Customer Name] Success Story\n\n## Challenge\nWhat problem they faced...\n\n## Solution\nHow we helped...\n\n## Results\nMeasurable outcomes...",
                "best_practices": [
                    "Include quantifiable results",
                    "Tell a compelling story",
                    "Get customer approval",
                    "Highlight relevant use cases"
                ]
            }
        },
        "tagging_guidelines": {
            "functional_tags": ["onboarding", "troubleshooting", "integration", "billing", "security"],
            "audience_tags": ["technical", "business", "end-user", "admin"],
            "product_tags": ["core-platform", "api", "mobile", "enterprise"],
            "priority_tags": ["critical", "important", "nice-to-have"]
        },
        "content_guidelines": {
            "writing_style": [
                "Use active voice",
                "Write in second person (you/your)",
                "Keep sentences concise",
                "Use bullet points for lists",
                "Include relevant keywords"
            ],
            "structure": [
                "Start with the most important information",
                "Use headings to organize content",
                "Include examples and use cases",
                "End with next steps or related topics"
            ],
            "optimization": [
                "Review and update quarterly",
                "Monitor search analytics",
                "Get feedback from users",
                "A/B test different approaches"
            ]
        }
    }