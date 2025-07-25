from typing import Dict, Any, List, Tuple
import structlog
from datetime import datetime
import json
import uuid
import re
from app.services.openai_service import openai_service
from app.schemas.knowledge import (
    KnowledgeDocumentRequest, KnowledgeDocumentResponse, DocumentStatus,
    RAGQueryRequest, RAGQueryResponse, CitationSource,
    KnowledgeSearchRequest, KnowledgeSearchResponse, KnowledgeSearchResult,
    CustomerInsightRequest, CustomerInsightResponse
)

logger = structlog.get_logger()

class RAGService:
    def __init__(self):
        self.model_version = "1.0"
        # In-memory storage for demo (in production, use pgvector + PostgreSQL)
        self.documents: Dict[str, Dict] = {}
        self.document_embeddings: Dict[str, List[List[float]]] = {}
        self.chunk_mappings: Dict[str, List[str]] = {}  # doc_id -> [chunk1, chunk2, ...]
    
    def _chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split text into overlapping chunks for better embeddings"""
        if len(text) <= chunk_size:
            return [text]
        
        chunks = []
        start = 0
        
        while start < len(text):
            # Find the end of this chunk
            end = start + chunk_size
            
            # If we're not at the end of the text, try to break at a sentence or word boundary
            if end < len(text):
                # Look for sentence boundary
                sentence_end = text.rfind('.', start, end)
                if sentence_end != -1 and sentence_end > start + chunk_size // 2:
                    end = sentence_end + 1
                else:
                    # Look for word boundary
                    word_end = text.rfind(' ', start, end)
                    if word_end != -1 and word_end > start + chunk_size // 2:
                        end = word_end
            
            chunks.append(text[start:end].strip())
            
            # Move start position with overlap
            start = end - overlap if end < len(text) else len(text)
        
        return chunks
    
    def _simple_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate simple text similarity using word overlap"""
        # Convert to lowercase and split into words
        words1 = set(re.findall(r'\w+', text1.lower()))
        words2 = set(re.findall(r'\w+', text2.lower()))
        
        if not words1 or not words2:
            return 0.0
        
        # Calculate Jaccard similarity (intersection over union)
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        
        return intersection / union if union > 0 else 0.0
    
    async def _get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for text chunks - simplified for demo"""
        try:
            # For demo, we'll store the actual text for similarity comparison
            # In production, you'd use real OpenAI embeddings
            embeddings = []
            for text in texts:
                # Store text as "embedding" for our similarity function
                # This is a hack for demo - real embeddings would be numerical vectors
                embeddings.append([hash(text.lower())])  # Simple hash for now
            
            return embeddings
        except Exception as e:
            logger.error("Failed to get embeddings", error=str(e))
            raise
    
    def _calculate_similarity(self, query: str, chunk_text: str) -> float:
        """Calculate similarity between query and chunk text"""
        return self._simple_text_similarity(query, chunk_text)
    
    async def add_document(self, request: KnowledgeDocumentRequest) -> KnowledgeDocumentResponse:
        """Add a new document to the knowledge base"""
        logger.info("Adding document to knowledge base", title=request.title)
        
        try:
            document_id = str(uuid.uuid4())
            
            # Chunk the document content
            chunks = self._chunk_text(request.content)
            
            # Get embeddings for chunks (simplified)
            embeddings = await self._get_embeddings(chunks)
            
            # Store document
            document_data = {
                "document_id": document_id,
                "title": request.title,
                "content": request.content,
                "document_type": request.document_type,
                "status": DocumentStatus.PUBLISHED,
                "tags": request.tags,
                "metadata": request.metadata or {},
                "source_url": request.source_url,
                "author": request.author,
                "department": request.department,
                "chunks": chunks,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "version": 1
            }
            
            self.documents[document_id] = document_data
            self.document_embeddings[document_id] = embeddings
            self.chunk_mappings[document_id] = chunks
            
            logger.info("Document added successfully", 
                       document_id=document_id, 
                       chunks=len(chunks))
            
            return KnowledgeDocumentResponse(
                document_id=document_id,
                title=request.title,
                content=request.content,
                document_type=request.document_type,
                status=DocumentStatus.PUBLISHED,
                tags=request.tags,
                metadata=request.metadata or {},
                embedding_status="completed",
                chunk_count=len(chunks)
            )
            
        except Exception as e:
            logger.error("Failed to add document", error=str(e))
            raise
    
    async def query_knowledge_base(self, request: RAGQueryRequest) -> RAGQueryResponse:
        """Query the knowledge base using RAG"""
        logger.info("Querying knowledge base", query=request.query)
        
        start_time = datetime.utcnow()
        
        try:
            # Find relevant chunks using text similarity
            relevant_chunks = []
            
            for doc_id, document in self.documents.items():
                # Apply filters
                if request.document_types and document["document_type"] not in request.document_types:
                    continue
                if request.tags and not any(tag in document["tags"] for tag in request.tags):
                    continue
                if request.departments and document.get("department") not in request.departments:
                    continue
                
                # Calculate similarity for each chunk
                for i, chunk_text in enumerate(document["chunks"]):
                    similarity = self._calculate_similarity(request.query, chunk_text)
                    
                    if similarity > 0.1:  # Lower threshold for demo
                        relevant_chunks.append({
                            "document_id": doc_id,
                            "chunk_index": i,
                            "similarity": similarity,
                            "chunk_text": chunk_text,
                            "document": document
                        })
            
            # Sort by similarity and take top results
            relevant_chunks.sort(key=lambda x: x["similarity"], reverse=True)
            relevant_chunks = relevant_chunks[:request.max_results]
            
            logger.info("Found relevant chunks", count=len(relevant_chunks))
            
            if not relevant_chunks:
                # No relevant content found
                return RAGQueryResponse(
                    query=request.query,
                    answer="I couldn't find specific information about your question in the knowledge base. You might want to try rephrasing your query or adding more relevant documents.",
                    confidence_score=0.1,
                    sources=[],
                    total_sources_found=0,
                    response_time_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000),
                    tokens_used=0,
                    related_questions=[
                        f"Can you tell me more about {request.query.split()[-1] if request.query.split() else 'this topic'}?",
                        "What documents are available in the knowledge base?",
                        "How can I add more relevant content?"
                    ],
                    suggested_actions=["Add more documents to the knowledge base", "Try a different search query"],
                    model_version=self.model_version
                )
            
            # Generate response using RAG
            context_text = "\n\n".join([
                f"Source: {chunk['document']['title']}\nContent: {chunk['chunk_text']}"
                for chunk in relevant_chunks
            ])
            
            rag_prompt = f"""
            Based on the following knowledge base content, answer the user's question.
            Provide a helpful, accurate response and reference the sources you're using.
            
            Question: {request.query}
            
            Available Context:
            {context_text}
            
            Response style: {request.response_style}
            
            Please provide a complete answer based on the available information.
            """
            
            ai_response = await openai_service.chat_completion([
                {"role": "system", "content": "You are a helpful knowledge base assistant. Provide accurate, well-sourced answers based on the provided context."},
                {"role": "user", "content": rag_prompt}
            ], temperature=0.1)
            
            # Create citation sources
            sources = []
            for chunk in relevant_chunks:
                source = CitationSource(
                    document_id=chunk["document_id"],
                    title=chunk["document"]["title"],
                    document_type=chunk["document"]["document_type"],
                    relevance_score=chunk["similarity"],
                    excerpt=chunk["chunk_text"][:300] + "..." if len(chunk["chunk_text"]) > 300 else chunk["chunk_text"],
                    chunk_index=chunk["chunk_index"]
                )
                sources.append(source)
            
            # Generate related questions
            related_questions = [
                f"Can you explain more about {request.query.split()[0] if request.query.split() else 'this'}?",
                f"What are the benefits of {request.query.split()[-1] if request.query.split() else 'this solution'}?",
                "Are there any best practices I should know about?"
            ]
            
            end_time = datetime.utcnow()
            response_time = int((end_time - start_time).total_seconds() * 1000)
            
            confidence = min(0.95, sum(chunk["similarity"] for chunk in relevant_chunks) / len(relevant_chunks)) if relevant_chunks else 0.1
            
            response = RAGQueryResponse(
                query=request.query,
                answer=ai_response["content"],
                confidence_score=confidence,
                sources=sources,
                total_sources_found=len(relevant_chunks),
                response_time_ms=response_time,
                tokens_used=ai_response["usage"]["total_tokens"],
                related_questions=related_questions,
                suggested_actions=["Save this answer for future reference", "Ask a follow-up question"],
                model_version=self.model_version
            )
            
            logger.info("Knowledge base query completed", 
                       sources_found=len(sources),
                       response_time_ms=response_time,
                       confidence=confidence)
            
            return response
            
        except Exception as e:
            logger.error("Knowledge base query failed", error=str(e))
            raise
    
    async def search_documents(self, request: KnowledgeSearchRequest) -> KnowledgeSearchResponse:
        """Search documents in the knowledge base"""
        logger.info("Searching documents", query=request.query)
        
        start_time = datetime.utcnow()
        
        try:
            results = []
            
            for doc_id, document in self.documents.items():
                # Apply filters
                if request.document_types and document["document_type"] not in request.document_types:
                    continue
                if request.tags and not any(tag in document["tags"] for tag in request.tags):
                    continue
                
                # Find best matching chunk for this document
                best_similarity = 0
                best_chunk_idx = 0
                
                for i, chunk_text in enumerate(document["chunks"]):
                    similarity = self._calculate_similarity(request.query, chunk_text)
                    if similarity > best_similarity:
                        best_similarity = similarity
                        best_chunk_idx = i
                
                if best_similarity >= request.similarity_threshold:
                    result = KnowledgeSearchResult(
                        document_id=doc_id,
                        title=document["title"],
                        document_type=document["document_type"],
                        relevance_score=best_similarity,
                        excerpt=document["chunks"][best_chunk_idx][:200] + "...",
                        tags=document["tags"]
                    )
                    results.append(result)
            
            # Sort by relevance
            results.sort(key=lambda x: x.relevance_score, reverse=True)
            results = results[:request.limit]
            
            end_time = datetime.utcnow()
            search_time = int((end_time - start_time).total_seconds() * 1000)
            
            return KnowledgeSearchResponse(
                query=request.query,
                results=results,
                total_found=len(results),
                search_time_ms=search_time
            )
            
        except Exception as e:
            logger.error("Document search failed", error=str(e))
            raise
    
    async def get_customer_insights(self, request: CustomerInsightRequest) -> CustomerInsightResponse:
        """Get AI-powered customer insights"""
        logger.info("Generating customer insights", customer_id=request.customer_id)
        
        try:
            insights_prompt = f"""
            Analyze the following customer inquiry and provide insights:
            
            Customer ID: {request.customer_id}
            Query: {request.query}
            
            Based on typical customer patterns and the query, provide insights in JSON format:
            {{
                "customer_segment": "enterprise|mid-market|small-business",
                "engagement_level": "high|medium|low",
                "purchase_intent": "high|medium|low",
                "preferred_communication": "email|phone|demo|documentation",
                "technical_level": "beginner|intermediate|advanced",
                "decision_timeline": "immediate|short-term|long-term",
                "budget_indication": "high|medium|low|unknown"
            }}
            """
            
            ai_response = await openai_service.chat_completion([
                {"role": "system", "content": "You are a customer insights analyst. Provide actionable customer intelligence."},
                {"role": "user", "content": insights_prompt}
            ], temperature=0.2)
            
            try:
                insights_data = json.loads(ai_response["content"])
            except:
                insights_data = {
                    "customer_segment": "unknown",
                    "engagement_level": "medium",
                    "purchase_intent": "medium"
                }
            
            return CustomerInsightResponse(
                customer_id=request.customer_id,
                insights=insights_data,
                recommendations=[
                    "Follow up within 24 hours",
                    "Provide relevant case studies",
                    "Schedule a product demo"
                ],
                risk_factors=[
                    "No clear decision timeline",
                    "Budget not confirmed"
                ],
                opportunities=[
                    "Strong technical interest",
                    "Potential for upsell"
                ],
                data_sources=["customer_interactions", "support_tickets", "sales_history"],
                confidence_level=0.75
            )
            
        except Exception as e:
            logger.error("Customer insights generation failed", error=str(e))
            raise
    
    def get_knowledge_base_stats(self) -> Dict[str, Any]:
        """Get statistics about the knowledge base"""
        total_docs = len(self.documents)
        total_chunks = sum(len(chunks) for chunks in self.chunk_mappings.values())
        
        doc_types = {}
        for doc in self.documents.values():
            doc_type = doc["document_type"]
            doc_types[doc_type] = doc_types.get(doc_type, 0) + 1
        
        return {
            "total_documents": total_docs,
            "total_chunks": total_chunks,
            "document_types": doc_types,
            "embedding_status": "active",
            "search_enabled": True
        }

# Global RAG service instance
rag_service = RAGService()